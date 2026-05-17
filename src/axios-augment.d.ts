import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    _fromQueue?: boolean
  }
}
