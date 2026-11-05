"use client"

import { useParams } from "next/navigation"
import UserForm from "@/app/components/user-form"

const EditUserPage = () => {
  const params = useParams<{ id: string }>()

  return <UserForm mode="edit" userId={params.id} />
}

export default EditUserPage