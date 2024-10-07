import {invoke, type InvokeArgs, type InvokeOptions} from "@tauri-apps/api/core"
export const prerender = true
export const ssr = false

declare global {
  interface Window { invoke: <T>(cmd: string, args?: InvokeArgs | undefined, options?: InvokeOptions | undefined) => Promise<T>  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function load({ params }) {
  // TODO(rkofman): remove this stub in favor of implementing the .ts side of the sqlite-proxy plugin.
  window.invoke = invoke;
}
