import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { apiClient } from "@/lib/api-client"
import { devAutoLogin, devStubAdmin } from "@/lib/dev-auth"
import type { AdminLoginResponse, AdminUser } from "@/types/api"

const DEV_ADMIN: AdminUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@chasqui.local",
  full_name: "Dev Admin",
  role: "super_admin",
  is_active: true,
  created_at: new Date(0).toISOString(),
  last_login_at: null,
}

const skipMe = devAutoLogin && devStubAdmin

export function useAdminAuth() {
  return useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const { data } = await apiClient.get<AdminUser>("/admin/auth/me")
      return data
    },
    retry: false,
    enabled: !skipMe,
    initialData: skipMe ? DEV_ADMIN : undefined,
  })
}

export function useAdminLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const formData = new URLSearchParams()
      formData.append("username", credentials.email)
      formData.append("password", credentials.password)

      const { data } = await apiClient.post<AdminLoginResponse>(
        "/admin/auth/login",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )
      return data
    },
    onSuccess: (data) => {
      localStorage.setItem("admin_access_token", data.access_token)
      localStorage.setItem("admin_refresh_token", data.refresh_token)
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] })
      navigate("/")
    },
  })
}

export function useAdminLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return () => {
    localStorage.removeItem("admin_access_token")
    localStorage.removeItem("admin_refresh_token")
    queryClient.clear()
    navigate("/login")
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("admin_access_token")
}
