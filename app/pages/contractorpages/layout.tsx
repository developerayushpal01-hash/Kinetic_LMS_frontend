import { ReactNode } from "react"
import ContractorRoute from "@/app/components/contractor-route"

type ContractorLayoutProps = {
  children: ReactNode
}

const ContractorLayout = ({ children }: ContractorLayoutProps) => (
  <ContractorRoute>{children}</ContractorRoute>
)

export default ContractorLayout