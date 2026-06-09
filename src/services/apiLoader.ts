import type apiService from './api'

type ApiService = typeof apiService

let apiPromise: Promise<ApiService> | null = null

/** Carga diferida del servicio API (~370 KB). Usar tras login o en rutas autenticadas. */
export async function getApiService(): Promise<ApiService> {
  if (!apiPromise) {
    apiPromise = import('./api').then((m) => m.default)
  }
  return apiPromise
}
