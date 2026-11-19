const DEV_MARKER = "admin_dev_auto_login"

export const devAutoLogin = import.meta.env.VITE_DEV_AUTO_LOGIN === "true"
export const devStubAdmin = import.meta.env.VITE_DEV_STUB_ADMIN === "true"

export function setupDevAuth(): void {
  if (devAutoLogin) {
    const token = import.meta.env.VITE_DEV_ADMIN_TOKEN
    if (token) {
      localStorage.setItem("admin_access_token", token)
      localStorage.setItem(DEV_MARKER, "1")
    }
    return
  }

  if (localStorage.getItem(DEV_MARKER)) {
    localStorage.removeItem("admin_access_token")
    localStorage.removeItem("admin_refresh_token")
    localStorage.removeItem(DEV_MARKER)
  }
}
