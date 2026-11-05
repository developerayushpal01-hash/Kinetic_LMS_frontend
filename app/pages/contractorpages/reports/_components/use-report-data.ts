"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { apiUrl } from "@/lib/api"
import { useToast } from "@/app/components/toast-provider"
import type { Attendance, Labour, Payment, Salary, Site } from "./report-ui"
type Api<T> = { success: boolean; data?: T; message?: string }

export function useReportData(monthValue: string) {
  const { showToast } = useToast()
  const [data, setData] = useState<{ attendance: Attendance[]; salaries: Salary[]; labours: Labour[]; sites: Site[]; payments: Payment[] }>({ attendance: [], salaries: [], labours: [], sites: [], payments: [] })
  const [loading, setLoading] = useState(true)
  const [year, month] = monthValue.split("-").map(Number)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        fetch(apiUrl(`/reports/attendance/monthly?month=${month}&year=${year}`), { credentials: "include" }),
        fetch(apiUrl(`/salary/calculate?month=${month}&year=${year}`), { credentials: "include" }),
        fetch(apiUrl("/labours/get-labours"), { credentials: "include" }),
        fetch(apiUrl("/sites/get-sites"), { credentials: "include" }),
        fetch(apiUrl(`/reports/payments?month=${month}&year=${year}`), { credentials: "include" }),
      ])
      const results = await Promise.all(responses.map((response) => response.json())) as Api<unknown>[]
      const failed = responses.findIndex((response) => !response.ok)
      if (failed >= 0) throw new Error(results[failed].message || "Report data could not be loaded.")
      setData({ attendance: (results[0].data || []) as Attendance[], salaries: (results[1].data || []) as Salary[], labours: (results[2].data || []) as Labour[], sites: (results[3].data || []) as Site[], payments: (results[4].data || []) as Payment[] })
    } catch (error) { showToast(error instanceof Error ? error.message : "Report data could not be loaded.", "error") } finally { setLoading(false) }
  }, [month, year, showToast])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])
  const labourMap = useMemo(() => new Map(data.labours.map((labour) => [labour._id, labour])), [data.labours])
  return { ...data, labourMap, loading }
}
