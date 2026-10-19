import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { usuarioTieneAlgunRol, usuarioTieneRol } from './usuarioRolesExtra.ts'
import { esUsuarioCajaOperativa } from './ventasCajaScope.ts'
import { canUserAccessModule, type AdminModuleDef } from '../components/admin-module/adminModuleCatalog.ts'

const imprenta = { nombre: 'taller@plotcenter.com.ar', rol: 'imprenta' as const }

describe('imprenta incluye mostrador', () => {
  it('tiene rol mostrador implícito y no pierde imprenta', () => {
    assert.equal(usuarioTieneRol(imprenta, 'mostrador'), true)
    assert.equal(usuarioTieneRol(imprenta, 'imprenta'), true)
    assert.equal(usuarioTieneRol(imprenta, 'caja'), false)
    assert.equal(usuarioTieneAlgunRol(imprenta, ['mostrador', 'caja']), true)
  })

  it('acepta alias taller-imprenta', () => {
    const alias = { nombre: 'op@plotcenter.com.ar', rol: 'taller-imprenta' as 'imprenta' }
    assert.equal(usuarioTieneRol(alias, 'imprenta'), true)
    assert.equal(usuarioTieneRol(alias, 'mostrador'), true)
  })

  it('opera caja como mostrador', () => {
    assert.equal(esUsuarioCajaOperativa('imprenta'), true)
  })

  it('entra a módulos de mostrador', () => {
    const moduloMostrador: AdminModuleDef = {
      id: 'mostrador',
      title: 'Mostrador',
      description: 'test',
      icon: 'x',
      path: '/mostrador/dashboard',
      category: 'ventas',
      roles: ['mostrador', 'caja'],
      accent: '#000'
    }
    assert.equal(canUserAccessModule(imprenta, moduloMostrador), true)
    assert.equal(canUserAccessModule('imprenta', moduloMostrador), true)
  })
})
