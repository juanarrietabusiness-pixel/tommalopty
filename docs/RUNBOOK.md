# Runbook operativo

Qué hacer cuando algo pasa. Escrito para leerse a las 3 de la mañana, no para
lucir bien.

---

## Desplegar a producción

**Cuándo no desplegar:** viernes por la tarde, vísperas de campaña, o sin nadie
disponible para revertir.

```bash
# 1. develop está verde y probado en staging
git checkout main && git pull
git merge --no-ff develop
git push

# 2. Si hay migraciones, van PRIMERO y por separado
supabase link --project-ref <ref-produccion>
supabase db push

# 3. Desplegar las apps
pnpm --filter @nebula/storefront cf:deploy
pnpm --filter @nebula/admin cf:deploy
```

**Orden que importa:** la base de datos antes que el código, y las migraciones
siempre compatibles hacia atrás. Si la migración borra una columna que el código
viejo todavía usa, hay minutos de errores durante el despliegue.

### Después de desplegar, comprobar en 5 minutos

- [ ] La portada carga y muestra productos
- [ ] Se puede añadir al carrito
- [ ] El checkout carga y ofrece métodos de pago
- [ ] El panel abre y el dashboard muestra datos
- [ ] Sin picos de error en el panel de Cloudflare

## Revertir

**El código se revierte solo.** La base de datos no.

```bash
# Código: volver al despliegue anterior
wrangler rollback --name nebula-storefront

# O por git
git revert -m 1 <hash-del-merge>
git push
```

Si la migración añadió cosas (columnas, tablas, índices), **no hace falta
revertirla**: el código viejo las ignora. Por eso las migraciones aditivas son
seguras y las destructivas no.

Si la migración fue destructiva y hay que volver atrás: restaurar desde backup y
asumir la pérdida de datos desde ese punto. Es la razón por la que las
migraciones destructivas van en dos despliegues separados.

## Incidentes

### La tienda no carga

1. ¿Está Cloudflare caído? → https://www.cloudflarestatus.com
2. ¿Está Supabase caído? → https://status.supabase.com
3. Logs del worker: `wrangler tail --name nebula-storefront`
4. Si es el último despliegue: revertir primero, investigar después.

### La tienda carga pero muestra productos raros

Probablemente Supabase no responde y la app cayó al contenido de demostración.
**Esto es un fallo, no un modo de funcionamiento**: hay clientes viendo precios
inventados. Comprobar la conexión a Supabase de inmediato.

### Un pedido se cobró pero no aparece

1. Buscar en `payment_webhook_events` por el id del evento de la pasarela.
2. Si el evento llegó y `processed_at` está vacío → falló el procesamiento; ver
   `error_message`.
3. Si el evento no llegó → revisar la URL del webhook en el panel de la pasarela.
4. Reprocesar con el evento guardado; es idempotente, no duplica.

Nunca marcar un pedido como pagado a mano sin confirmarlo antes en el panel de
la pasarela.

### Stock descuadrado

`reserved_quantity` se incrementa al crear el pedido y se libera al cancelar o
al cumplir. Si queda descuadrado (por un proceso interrumpido):

```sql
-- Ver la discrepancia antes de tocar nada
select v.sku, i.quantity, i.reserved_quantity,
       (select coalesce(sum(oi.quantity), 0)
        from order_items oi join orders o on o.id = oi.order_id
        where oi.variant_id = i.variant_id
          and o.status not in ('cancelled','refunded')
          and o.fulfillment_status <> 'fulfilled') as reserva_real
from inventory i join product_variants v on v.id = i.variant_id
where i.track_inventory;
```

Recalcular solo tras revisar el resultado.

### Sospecha de acceso indebido

1. **No borrar nada.** Los logs son la evidencia.
2. Revocar la service-role key en Supabase y rotar todas las claves.
3. Revisar `audit_log` y `order_events` en la ventana sospechosa.
4. Comprobar si algún perfil cambió de rol:
   ```sql
   select id, email, role, updated_at from profiles
   where role <> 'customer' order by updated_at desc;
   ```
5. Si hay datos de clientes comprometidos, hay obligación de notificarlo.

## Rotar credenciales

Trimestral, y de inmediato si alguien del equipo se va.

```bash
# Supabase: panel → Settings → API → rotar
# Cloudflare: por cada secreto
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put PAYPAL_CLIENT_SECRET
# …y redesplegar
```

Nunca rotar las claves de pasarela en horario de ventas sin coordinar: los pagos
en vuelo fallan.

## Backups

Supabase hace backups automáticos en plan Pro. **Verificar que se pueden
restaurar** — un backup que nunca se probó no es un backup. Restaurar a un
proyecto de prueba una vez por trimestre.

## Contactos

| Qué                    | Dónde                            |
| ---------------------- | -------------------------------- |
| Estado de Cloudflare   | https://www.cloudflarestatus.com |
| Estado de Supabase     | https://status.supabase.com      |
| Soporte de la pasarela | _(rellenar al contratar)_        |
| Responsable técnico    | _(rellenar)_                     |
| Responsable de negocio | _(rellenar)_                     |
