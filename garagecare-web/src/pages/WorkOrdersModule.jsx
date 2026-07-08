import { useEffect, useMemo, useState } from 'react'
import './WorkOrdersModule.css'

const STATUSES = [
  { value: 'propose', label: 'Proposé' },
  { value: 'accepte', label: 'Accepté' },
  { value: 'prevu', label: 'Prévu' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
  { value: 'annule', label: 'Annulé' },
]

const emptyForm = {
  customer_id: '',
  vehicle_id: '',
  user_id: '',
  service_id: '',
  title: '',
  description: '',
  scheduled_at: '',
  status: 'propose',
  labor_amount: '',
  parts_amount: '',
  parts: [],
  paid_amount: '',
}

function asArray(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.data)) return response.data.data
  return []
}

function money(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function formatMoney(value) {
  return `${money(value).toLocaleString('fr-FR')} FCFA`
}

function orderAmountLabel(order) {
  const total = money(order?.total_amount || order?.estimated_amount)
  return total > 0 ? formatMoney(total) : 'Montant à compléter'
}

function formatDate(value) {
  if (!value) return 'Non planifié'
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (_) {
    return value
  }
}

function toInputDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeServices(order) {
  const raw = order?.services_snapshot ?? order?.services ?? order?.service_names ?? []

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') return item.name || item.title || item.label || item.service || ''
        return ''
      })
      .filter(Boolean)
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') return item
            if (item && typeof item === 'object') return item.name || item.title || item.label || item.service || ''
            return ''
          })
          .filter(Boolean)
      }
    } catch (_) {
      return raw.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }

  if (raw && typeof raw === 'object') {
    return Object.values(raw)
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') return item.name || item.title || item.label || item.service || ''
        return ''
      })
      .filter(Boolean)
  }

  return []
}

function orderTitle(order) {
  const services = normalizeServices(order)
  return order?.title || order?.problem_description || order?.description || services.join(', ') || 'Intervention garage'
}

function statusLabel(value) {
  return STATUSES.find((status) => status.value === value)?.label || value || 'Proposé'
}



function loyaltyStatus(order) {
  const points = Number(order?.loyalty_points || 0)

  if (order?.loyalty_awarded && points > 0) {
    return {
      awarded: true,
      label: `${points} pts fidélité attribués`,
    }
  }

  return {
    awarded: false,
    label: 'Points non encore attribués',
  }
}

function paymentStatus(order) {
  const total = money(order?.total_amount || order?.estimated_amount)
  const paid = money(order?.paid_amount)

  if (total <= 0) {
    return { label: 'Montant à compléter', className: 'wo-pay-unknown' }
  }

  if (paid <= 0) {
    return { label: 'Non payé', className: 'wo-pay-none' }
  }

  if (paid >= total) {
    return { label: 'Payé', className: 'wo-pay-full' }
  }

  return { label: `Paiement partiel : reste ${formatMoney(total - paid)}`, className: 'wo-pay-partial' }
}

function statusClass(value) {
  return `wo-status wo-status-${String(value || 'propose').replaceAll('_', '-')}`
}

function vehicleLabel(vehicle) {
  if (!vehicle) return ''
  return [
    vehicle.registration_number,
    vehicle.brand,
    vehicle.model,
  ].filter(Boolean).join(' · ')
}




function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function selectedServiceText(service) {
  return normalizeSearchText([
    service?.name,
    service?.category,
    service?.description,
    service?.advice,
  ].filter(Boolean).join(' '))
}

function stockItemText(item) {
  return normalizeSearchText([
    item?.name,
    item?.category,
  ].filter(Boolean).join(' '))
}

function partKeywordsForService(service) {
  const text = selectedServiceText(service)

  const rules = [
    {
      service: ['plaquette', 'plaquettes', 'frein', 'freinage', 'disque'],
      parts: ['plaquette', 'plaquettes', 'frein', 'freinage', 'disque', 'liquide frein'],
    },
    {
      service: ['batterie', 'demarrage', 'demarreur', 'electricite', 'electrique'],
      parts: ['batterie', 'batteries', 'cosse', 'cable', 'electricite'],
    },
    {
      service: ['vidange', 'huile', 'niveau', 'moteur', 'entretien rapide'],
      parts: ['huile', 'filtre huile', 'filtre a huile', 'liquide refroidissement'],
    },
    {
      service: ['filtre', 'filtration'],
      parts: ['filtre'],
    },
    {
      service: ['climatisation', 'clim', 'air'],
      parts: ['gaz', 'clim', 'filtre habitacle'],
    },
    {
      service: ['pneu', 'pression', 'roue'],
      parts: ['pneu', 'valve'],
    },
    {
      service: ['eclairage', 'phare', 'feu', 'ampoule'],
      parts: ['ampoule', 'phare', 'feu'],
    },
    {
      service: ['courroie'],
      parts: ['courroie'],
    },
  ]

  const matched = rules
    .filter((rule) => rule.service.some((keyword) => text.includes(keyword)))
    .flatMap((rule) => rule.parts)

  return [...new Set(matched)]
}

function isRecommendedPartForService(item, service) {
  const keywords = partKeywordsForService(service)

  if (keywords.length === 0) {
    return false
  }

  const itemText = stockItemText(item)

  return keywords.some((keyword) => itemText.includes(normalizeSearchText(keyword)))
}

function orderPartsRows(order) {
  if (!Array.isArray(order?.parts)) return []

  return order.parts.map((part) => ({
    id: part.id || `${part.stock_item_id || part.stock_item_name}`,
    name: part.stock_item_name || part.name || 'Pièce',
    category: part.category || 'Stock',
    quantity: money(part.quantity || 0),
    unit_price: money(part.unit_price || 0),
    total_amount: money(part.total_amount || 0),
  })).filter((part) => part.name && part.quantity > 0)
}

function normalizeExistingOrderParts(parts) {
  if (!Array.isArray(parts)) return []

  return parts.map((part) => ({
    stock_item_id: part.stock_item_id || '',
    stock_item_name: part.stock_item_name || part.name || '',
    category: part.category || '',
    quantity: part.quantity || 1,
    unit_price: part.unit_price || 0,
  }))
}

export default function WorkOrdersModule({ api }) {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [users, setUsers] = useState([])
  const [services, setServices] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filters, setFilters] = useState({ q: '', status: 'all', customer_id: 'all' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [ordersResponse, customersResponse, vehiclesResponse, servicesResponse] = await Promise.all([
        api('/work-orders'),
        api('/customers'),
        api('/vehicles'),
        api('/services'),
      ])

      const nextOrders = asArray(ordersResponse)
      setOrders(nextOrders)
      setCustomers(asArray(customersResponse))
      setVehicles(asArray(vehiclesResponse))
      setServices(asArray(servicesResponse))

      try {
        const stockResponse = await api('/stock-items')
        setStockItems(asArray(stockResponse))
      } catch {
        setStockItems([])
      }

      if (!selectedId && nextOrders[0]?.id) {
        setSelectedId(nextOrders[0].id)
      }
    } catch (err) {
      setError(err?.message || 'Impossible de charger les devis / interventions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const customerMap = useMemo(() => {
    return new Map(customers.map((customer) => [Number(customer.id), customer]))
  }, [customers])

  const vehicleMap = useMemo(() => {
    return new Map(vehicles.map((vehicle) => [Number(vehicle.id), vehicle]))
  }, [vehicles])

  const activeServices = useMemo(() => {
    return services.filter((service) => service.is_active !== false)
  }, [services])

  const filteredFormVehicles = useMemo(() => {
    if (!form.customer_id) return vehicles

    return vehicles.filter((vehicle) => {
      return !vehicle.customer_id || Number(vehicle.customer_id) === Number(form.customer_id)
    })
  }, [vehicles, form.customer_id])

  const availableStockItems = useMemo(() => {
    return stockItems.filter((item) => Number(item.quantity ?? 0) > 0)
  }, [stockItems])

  const selectedServiceForForm = useMemo(() => {
    return activeServices.find((item) => Number(item.id) === Number(form.service_id)) || null
  }, [activeServices, form.service_id])

  const recommendedStockItems = useMemo(() => {
    const recommended = availableStockItems.filter((item) => isRecommendedPartForService(item, selectedServiceForForm))

    return recommended.length > 0 ? recommended : availableStockItems
  }, [availableStockItems, selectedServiceForForm])

  const formPartRows = useMemo(() => {
    return (form.parts || []).map((part) => {
      const stockItem = stockItems.find((item) => Number(item.id) === Number(part.stock_item_id))
      const quantity = money(part.quantity || 1)
      const unitPrice = money(part.unit_price || stockItem?.unit_price)
      const name = part.stock_item_name || stockItem?.name || 'Pièce'
      const category = part.category || stockItem?.category || 'Stock'
      const total = quantity * unitPrice

      return {
        stock_item_id: part.stock_item_id ? Number(part.stock_item_id) : null,
        stock_item_name: name,
        category,
        quantity,
        unit_price: unitPrice,
        total_amount: total,
      }
    }).filter((part) => part.stock_item_name && part.quantity > 0)
  }, [form.parts, stockItems])

  const formPartsTotal = useMemo(() => {
    return formPartRows.reduce((sum, part) => sum + money(part.total_amount), 0)
  }, [formPartRows])

  function addPartRow() {
    const first = recommendedStockItems[0] || availableStockItems[0]

    if (!first) {
      return
    }

    setForm((current) => ({
      ...current,
      parts: [
        ...(current.parts || []),
        {
          stock_item_id: first.id || '',
          stock_item_name: first.name || '',
          category: first.category || '',
          quantity: 1,
          unit_price: first.unit_price || 0,
        },
      ],
    }))
  }

  function updatePartRow(index, patch) {
    setForm((current) => {
      const parts = [...(current.parts || [])]
      const next = {
        ...(parts[index] || {}),
        ...patch,
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'stock_item_id')) {
        const stockItem = stockItems.find((item) => Number(item.id) === Number(patch.stock_item_id))

        if (stockItem) {
          next.stock_item_name = stockItem.name
          next.category = stockItem.category
          next.unit_price = stockItem.unit_price
        }
      }

      parts[index] = next

      return {
        ...current,
        parts,
      }
    })
  }

  function removePartRow(index) {
    setForm((current) => ({
      ...current,
      parts: (current.parts || []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }


  const visibleOrders = useMemo(() => {
    const q = filters.q.trim().toLowerCase()

    return orders
      .filter((order) => {
        if (filters.status !== 'all' && order.status !== filters.status) return false
        if (filters.customer_id !== 'all' && Number(order.customer_id) !== Number(filters.customer_id)) return false

        if (!q) return true

        const customer = order.customer || customerMap.get(Number(order.customer_id))
        const vehicle = order.vehicle || vehicleMap.get(Number(order.vehicle_id))
        const haystack = [
          orderTitle(order),
          order.description,
          order.problem_description,
          statusLabel(order.status),
          customer?.name,
          customer?.phone,
          vehicleLabel(vehicle),
          normalizeServices(order).join(' '),
        ].filter(Boolean).join(' ').toLowerCase()

        return haystack.includes(q)
      })
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
  }, [orders, filters, customerMap, vehicleMap])

  useEffect(() => {
    let active = true

    api('/users')
      .then((response) => {
        if (!active) return
        const payload = response?.data ?? response
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
        setUsers(rows)
      })
      .catch(() => {
        if (active) setUsers([])
      })

    return () => {
      active = false
    }
  }, [api])

  const selectedOrder = useMemo(() => {
    return orders.find((order) => Number(order.id) === Number(selectedId)) || visibleOrders[0] || null
  }, [orders, selectedId, visibleOrders])

  const stats = useMemo(() => {
    const openStatuses = new Set(['propose', 'accepte', 'prevu', 'en_cours'])
    const paid = orders.filter((order) => money(order.paid_amount) >= money(order.total_amount || order.estimated_amount) && money(order.total_amount || order.estimated_amount) > 0)
    const totalOpen = orders.filter((order) => openStatuses.has(order.status)).length
    const totalEstimated = orders.reduce((sum, order) => sum + money(order.total_amount || order.estimated_amount), 0)
    const totalPaid = orders.reduce((sum, order) => sum + money(order.paid_amount), 0)

    return {
      total: orders.length,
      open: totalOpen,
      paid: paid.length,
      totalEstimated,
      totalPaid,
    }
  }, [orders])

  function patchForm(partial) {
    setForm((current) => ({ ...current, ...partial }))
  }

  function resetForm(options = {}) {
    setEditingId(null)
    setForm(emptyForm)

    if (!options.keepFeedback) {
      setMessage('')
      setError('')
    }
  }

  function editOrder(order) {
    setEditingId(order.id)
    setSelectedId(order.id)

    setForm({
      customer_id: order.customer_id || '',
      vehicle_id: order.vehicle_id || '',
      service_id: order.service_id || '',
      title: order.title || '',
      description: order.description || order.problem_description || '',
      user_id: order.user_id ? String(order.user_id) : '',
      scheduled_at: toInputDateTime(order.scheduled_at),
      status: order.status || 'propose',
      labor_amount: order.labor_amount || order.estimated_amount || '',
      parts_amount: order.parts_amount || '',
      parts: normalizeExistingOrderParts(order.parts || []),
      paid_amount: order.paid_amount || '',
    })
  }

  function onServiceChange(serviceId) {
    const service = activeServices.find((item) => Number(item.id) === Number(serviceId))
    patchForm({
      service_id: serviceId,
      title: service?.name || form.title,
      labor_amount: service?.estimated_price ?? form.labor_amount,
    })
  }

  function buildPayload() {
    const service = activeServices.find((item) => Number(item.id) === Number(form.service_id))
    const labor = money(form.labor_amount)
    const parts = formPartsTotal > 0 ? formPartsTotal : money(form.parts_amount)
    const total = labor + parts
    const paid = money(form.paid_amount)
    const title = (form.title || service?.name || 'Intervention garage').trim()
    const description = (form.description || title || service?.advice || 'Intervention garage').trim()
    const serviceNames = service ? [service.name] : [title]
    const payloadParts = formPartRows.length > 0
      ? formPartRows.map((part) => ({
          stock_item_id: part.stock_item_id,
          stock_item_name: part.stock_item_name,
          category: part.category,
          quantity: part.quantity,
          unit_price: part.unit_price,
        }))
      : undefined

    const payload = {
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      vehicle_id: form.vehicle_id ? Number(form.vehicle_id) : null,
      user_id: form.user_id ? Number(form.user_id) : null,
      service_id: form.service_id ? Number(form.service_id) : null,
      title,
      description,
      problem_description: description,
      services: serviceNames,
      services_snapshot: serviceNames,
      status: form.status || 'propose',
      scheduled_at: form.scheduled_at ? form.scheduled_at.replace('T', ' ') + ':00' : null,
      labor_amount: labor,
      parts_amount: parts,
      estimated_amount: total,
      total_amount: total,
      paid_amount: paid,
      parts: payloadParts,
    }

    if (total > 0 && paid >= total) {
      payload.paid_at = new Date().toISOString()
    }

    return payload
  }

  async function saveOrder(event) {
    event.preventDefault()

    if (!form.customer_id) {
      setError('Sélectionne un client.')
      return
    }

    if (!form.vehicle_id) {
      setError('Sélectionne un véhicule.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const payload = buildPayload()
      const path = editingId ? `/work-orders/${editingId}` : '/work-orders'
      const method = editingId ? 'PUT' : 'POST'
      const response = await api(path, {
        method,
        body: JSON.stringify(payload),
      })

      const saved = response?.data
      setMessage(editingId ? 'Intervention mise à jour.' : 'Devis / intervention enregistré.')
      resetForm({ keepFeedback: true })
      await loadAll()

      if (saved?.id) {
        setSelectedId(saved.id)
      }
    } catch (err) {
      setError(err?.message || 'Enregistrement impossible.')
    } finally {
      setLoading(false)
    }
  }

  async function updateOrder(order, patch, successMessage) {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await api(`/work-orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })

      const saved = response?.data
      const loyalty = response?.loyalty
      const baseMessage = successMessage || 'Intervention mise à jour.'

      if (loyalty?.awarded) {
        setMessage(`${baseMessage} ${loyalty.points} points fidélité attribués.`)
      } else if (loyalty?.reason === 'already_awarded') {
        setMessage(`${baseMessage} Points fidélité déjà attribués.`)
      } else {
        setMessage(baseMessage)
      }

      await loadAll()
      if (saved?.id) setSelectedId(saved.id)
    } catch (err) {
      setError(err?.message || 'Mise à jour impossible.')
    } finally {
      setLoading(false)
    }
  }

  function changeStatus(order, status) {
    updateOrder(order, { status }, `Statut changé : ${statusLabel(status)}.`)
  }

  function markPaid(order) {
    const total = money(order.total_amount || order.estimated_amount)

    if (total <= 0) {
      setError('Impossible de marquer payé : le total du dossier est à 0. Complète d’abord la main-d’œuvre ou les pièces.')
      return
    }

    updateOrder(order, {
      paid_amount: total,
      paid_at: new Date().toISOString(),
      status: 'termine',
    }, 'Paiement enregistré et intervention terminée.')
  }

  async function deleteOrder(order) {
    const ok = window.confirm(`Supprimer "${orderTitle(order)}" ?`)
    if (!ok) return

    setLoading(true)
    setError('')
    setMessage('')

    try {
      await api(`/work-orders/${order.id}`, { method: 'DELETE' })
      setMessage('Intervention supprimée.')
      setSelectedId(null)
      await loadAll()
    } catch (err) {
      setError(err?.message || 'Suppression impossible.')
    } finally {
      setLoading(false)
    }
  }

  const selectedCustomer = selectedOrder?.customer || customerMap.get(Number(selectedOrder?.customer_id))
  const selectedVehicle = selectedOrder?.vehicle || vehicleMap.get(Number(selectedOrder?.vehicle_id))
  const userMap = useMemo(() => new Map(users.map((user) => [Number(user.id), user])), [users])

  function responsibleName(order) {
    const user = order?.user || order?.assigned_user || userMap.get(Number(order?.user_id))
    if (user?.name) return user.name
    if (user?.email) return user.email
    if (order?.user_id) return `Responsable #${order.user_id}`
    return 'Non assigné'
  }

  const selectedResponsible = selectedOrder ? responsibleName(selectedOrder) : 'Non assigné'
  const selectedServices = normalizeServices(selectedOrder)
  const selectedParts = selectedOrder ? orderPartsRows(selectedOrder) : []
  const selectedTotal = money(selectedOrder?.total_amount || selectedOrder?.estimated_amount)
  const selectedPaid = money(selectedOrder?.paid_amount)
  const selectedBalance = Math.max(0, selectedTotal - selectedPaid)
  const selectedBeforePhoto = selectedOrder?.before_photo_data || ''
  const selectedAfterPhoto = selectedOrder?.after_photo_data || ''
  const selectedBeforePhotoSrc = selectedBeforePhoto
    ? (String(selectedBeforePhoto).startsWith('data:') ? selectedBeforePhoto : `data:image/jpeg;base64,${selectedBeforePhoto}`)
    : ''
  const selectedAfterPhotoSrc = selectedAfterPhoto
    ? (String(selectedAfterPhoto).startsWith('data:') ? selectedAfterPhoto : `data:image/jpeg;base64,${selectedAfterPhoto}`)
    : ''

  const selectedReportRows = selectedOrder ? [
    ['Dossier', `#${selectedOrder.id}`],
    ['Client', selectedCustomer?.name || 'Non renseigné'],
    ['Téléphone', selectedCustomer?.phone || 'Non renseigné'],
    ['Véhicule', vehicleLabel(selectedVehicle) || 'Non renseigné'],
    ['Responsable', selectedResponsible],
    ['Tâche / service', orderTitle(selectedOrder)],
    ['Services', selectedServices.join(', ') || 'Non renseigné'],
    ['Statut', statusLabel(selectedOrder.status)],
    ['Date planifiée', formatDate(selectedOrder.scheduled_at)],
    ['Diagnostic / description', selectedOrder.description || selectedOrder.problem_description || 'Non renseigné'],
    ['Main-d’œuvre / service', formatMoney(selectedOrder.labor_amount || selectedOrder.estimated_amount)],
    ['Pièces / consommables', formatMoney(selectedOrder.parts_amount)],
    ['Total intervention', formatMoney(selectedTotal)],
    ['Montant payé', formatMoney(selectedPaid)],
    ['Reste à payer', formatMoney(selectedBalance)],
    ['Remise fidélité', selectedOrder.discount_amount ? formatMoney(selectedOrder.discount_amount) : 'Aucune'],
    ['Fidélité', loyaltyStatus(selectedOrder).label],
  ] : []

  const selectedReportText = selectedReportRows.map(([label, value]) => `${label}: ${value}`).join('\n')

  async function copySelectedReport() {
    if (!selectedReportText) return

    try {
      await navigator.clipboard.writeText(selectedReportText)
      setMessage('Rapport intervention copié.')
    } catch {
      setMessage('Rapport prêt : copie manuelle possible depuis la fiche.')
    }
  }

  function printSelectedReport() {
    setMessage('Ouverture de l’impression du rapport intervention.')
    window.print()
  }
  const formLabor = money(form.labor_amount)
  const formParts = formPartsTotal > 0 ? formPartsTotal : money(form.parts_amount)
  const formPaid = money(form.paid_amount)
  const formTotal = formLabor + formParts
  const formBalance = Math.max(0, formTotal - formPaid)

  return (
    <div className="workorders-page">
      <header className="wo-hero">
        <div>
          <span className="wo-kicker">GarageCare Offline</span>
          <h1>Devis & interventions</h1>
          <p>
            Suivi propre des demandes, devis, maintenances, paiements et états d’avancement du garage.
          </p>
        </div>
        <button className="wo-primary" onClick={resetForm}>
          + Nouveau devis
        </button>
      </header>

      <section className="wo-stats-grid">
        <StatCard label="Total dossiers" value={stats.total} hint="Devis et interventions" />
        <StatCard label="En cours" value={stats.open} hint="Proposés, acceptés, prévus ou en cours" />
        <StatCard label="Payés" value={stats.paid} hint="Solde réglé" />
        <StatCard label="Recettes encaissées" value={formatMoney(stats.totalPaid)} hint={`Estimé : ${formatMoney(stats.totalEstimated)}`} accent />
      </section>

      {(message || error) && (
        <div className={error ? 'wo-alert wo-alert-error' : 'wo-alert wo-alert-ok'}>
          {error || message}
        </div>
      )}

      <section className="wo-layout">
        <aside className="wo-list-card">
          <div className="wo-card-head">
            <div>
              <h2>Dossiers atelier</h2>
              <p>{visibleOrders.length} résultat(s)</p>
            </div>
            {loading && <span className="wo-loading">Chargement…</span>}
          </div>

          <div className="wo-filters">
            <input
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="Rechercher client, véhicule, service…"
            />

            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="all">Tous les statuts</option>
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>

            <select
              value={filters.customer_id}
              onChange={(event) => setFilters({ ...filters, customer_id: event.target.value })}
            >
              <option value="all">Tous les clients</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>

          <div className="wo-list">
            {visibleOrders.length === 0 ? (
              <div className="wo-empty">
                Aucun devis ou intervention trouvé.
              </div>
            ) : (
              visibleOrders.map((order) => {
                const customer = order.customer || customerMap.get(Number(order.customer_id))
                const vehicle = order.vehicle || vehicleMap.get(Number(order.vehicle_id))
                const active = Number(selectedOrder?.id) === Number(order.id)

                return (
                  <button
                    key={order.id}
                    className={`wo-list-item ${active ? 'active' : ''}`}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <span className={statusClass(order.status)}>{statusLabel(order.status)}</span>
                    <strong>{orderTitle(order)}</strong>
                    <small>{customer?.name || 'Client non renseigné'} · {vehicleLabel(vehicle) || 'Véhicule non renseigné'}</small>
                    <em>{orderAmountLabel(order)}</em>
                    <span className={`wo-payment-badge ${paymentStatus(order).className}`}>
                      {paymentStatus(order).label}
                    </span>
                    {loyaltyStatus(order).awarded && (
                      <span className="wo-loyalty-badge">
                        {loyaltyStatus(order).label}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="wo-detail-card">
          <div className="wo-card-head">
            <div>
              <h2>{selectedOrder ? orderTitle(selectedOrder) : 'Nouveau dossier'}</h2>
              <p>{selectedOrder ? `Dossier #${selectedOrder.id}` : 'Créer un devis ou une intervention'}</p>
            </div>
            {selectedOrder && (
              <span className={statusClass(selectedOrder.status)}>
                {statusLabel(selectedOrder.status)}
              </span>
            )}
          </div>

          {selectedOrder && (
            <section className="wo-detail-grid">
              <Info label="Client" value={selectedCustomer?.name || 'Non renseigné'} />
              <Info label="Téléphone" value={selectedCustomer?.phone || 'Non renseigné'} />
              <Info label="Véhicule" value={vehicleLabel(selectedVehicle) || 'Non renseigné'} />
              <Info label="Planification" value={formatDate(selectedOrder.scheduled_at)} />
              <Info label="Responsable" value={selectedResponsible} />
              <Info label="Services" value={selectedServices.join(', ') || 'Non renseigné'} />
              <Info label="Main-d’œuvre / service" value={formatMoney(selectedOrder.labor_amount || selectedOrder.estimated_amount)} />
              <Info label="Coût pièces détachées" value={formatMoney(selectedOrder.parts_amount)} />
              <Info label="Total" value={formatMoney(selectedTotal)} />
              <Info label="Acompte / montant payé" value={formatMoney(selectedPaid)} />
              <Info label="Reste à payer" value={formatMoney(selectedBalance)} strong />
              <Info
                label="Fidélité"
                value={loyaltyStatus(selectedOrder).label}
                strong={loyaltyStatus(selectedOrder).awarded}
              />
            </section>
          )}

          {selectedOrder && (
            <section className="wo-report-card">
              <div className="wo-report-head">
                <div>
                  <span>Rapport véhicule</span>
                  <h3>Rapport intervention #{selectedOrder.id}</h3>
                  <p>Fiche de suivi complète : véhicule, responsable, travaux, pièces, paiement et preuves disponibles.</p>
                </div>
                <div className="wo-report-actions">
                  <button type="button" className="wo-small" onClick={copySelectedReport}>Copier rapport</button>
                  <button type="button" className="wo-small" onClick={printSelectedReport}>Imprimer</button>
                </div>
              </div>

              <div className="wo-report-grid">
                {selectedReportRows.map(([label, value]) => (
                  <div className="wo-report-info" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              {selectedParts.length > 0 && (
                <div className="wo-report-parts">
                  <h4>Pièces utilisées dans l’intervention</h4>
                  {selectedParts.map((part) => (
                    <div key={part.key || part.stock_item_id || part.name} className="wo-report-part-row">
                      <span>{part.name}</span>
                      <strong>{part.quantity} × {formatMoney(part.unit_price)} = {formatMoney(part.total_amount)}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="wo-report-photos">
                <div>
                  <span>Photo avant</span>
                  {selectedBeforePhotoSrc ? <img src={selectedBeforePhotoSrc} alt="Avant intervention" /> : <strong>Non disponible</strong>}
                </div>
                <div>
                  <span>Photo après</span>
                  {selectedAfterPhotoSrc ? <img src={selectedAfterPhotoSrc} alt="Après intervention" /> : <strong>Non disponible</strong>}
                </div>
              </div>
            </section>
          )}

          {selectedOrder && selectedParts.length > 0 && (
            <section className="wo-detail-parts">
              <div className="wo-detail-parts-head">
                <h3>Pièces utilisées</h3>
                <strong>{formatMoney(selectedParts.reduce((sum, part) => sum + part.total_amount, 0))}</strong>
              </div>

              <div className="wo-detail-parts-list">
                {selectedParts.map((part) => (
                  <div className="wo-detail-part-row" key={part.id}>
                    <div>
                      <strong>{part.name}</strong>
                      <span>{part.category}</span>
                    </div>
                    <span>{part.quantity} × {formatMoney(part.unit_price)}</span>
                    <b>{formatMoney(part.total_amount)}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedOrder && (
            <div className="wo-actions">
              {STATUSES.map((status) => (
                <button
                  key={status.value}
                  className="wo-small"
                  onClick={() => changeStatus(selectedOrder, status.value)}
                >
                  {status.label}
                </button>
              ))}
              <button className="wo-small wo-pay" onClick={() => markPaid(selectedOrder)}>
                Marquer payé
              </button>
              <button className="wo-small" onClick={() => editOrder(selectedOrder)}>
                Modifier
              </button>
              <button className="wo-small wo-danger" onClick={() => deleteOrder(selectedOrder)}>
                Supprimer
              </button>
            </div>
          )}

          <form className="wo-form" onSubmit={saveOrder}>
            <div className="wo-form-title">
              <h3>{editingId ? 'Modifier le dossier' : 'Nouveau devis / intervention'}</h3>
              {editingId && <button type="button" className="wo-link" onClick={resetForm}>Annuler modification</button>}
            </div>

            <div className="wo-form-grid">
              <label>
                Client
                <select
                  value={form.customer_id}
                  onChange={(event) => {
                    const customerId = event.target.value
                    const currentVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(form.vehicle_id))
                    const vehicleDoesNotBelong =
                      currentVehicle?.customer_id
                      && customerId
                      && Number(currentVehicle.customer_id) !== Number(customerId)

                    patchForm({
                      customer_id: customerId,
                      vehicle_id: vehicleDoesNotBelong ? '' : form.vehicle_id,
                    })
                  }}
                >
                  <option value="">Sélectionner</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name} — {customer.phone || 'sans téléphone'}</option>
                  ))}
                </select>
              </label>

              <label>
                Véhicule
                <select value={form.vehicle_id} onChange={(event) => patchForm({ vehicle_id: event.target.value })}>
                  <option value="">Sélectionner</option>
                  {filteredFormVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicleLabel(vehicle)} {vehicle.customer_id ? `— ${customerMap.get(Number(vehicle.customer_id))?.name || ''}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Service catalogue
                <select value={form.service_id} onChange={(event) => onServiceChange(event.target.value)}>
                  <option value="">Service libre / diagnostic</option>
                  {activeServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} — {formatMoney(service.estimated_price)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Statut
                <select value={form.status} onChange={(event) => patchForm({ status: event.target.value })}>
                  {STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </label>
                <label>
                  Responsable
                  <select value={form.user_id} onChange={(event) => patchForm({ user_id: event.target.value })}>
                    <option value="">Non assigné</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email || `Utilisateur #${user.id}`}
                      </option>
                    ))}
                  </select>
                </label>

              <label>
                Titre
                <input
                  value={form.title}
                  onChange={(event) => patchForm({ title: event.target.value })}
                  placeholder="Ex : Vidange + contrôle niveaux"
                />
              </label>

              <label>
                Date prévue
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(event) => patchForm({ scheduled_at: event.target.value })}
                />
              </label>

              <label>
                Main-d’œuvre / service
                <input
                  type="number"
                  min="0"
                  value={form.labor_amount}
                  onChange={(event) => patchForm({ labor_amount: event.target.value })}
                  placeholder="0"
                />
              </label>

              <label>
                Coût pièces détachées
                <input
                  type="number"
                  value={formPartsTotal > 0 ? formPartsTotal : form.parts_amount}
                  onChange={(event) => patchForm({ parts_amount: event.target.value })}
                  min="0"
                  placeholder="0"
                  readOnly={formPartRows.length > 0}
                />
                <small>
                  Calculé automatiquement si tu ajoutes des pièces du stock.
                </small>
              </label>

              <div className="wo-full wo-parts-picker">
                <div className="wo-parts-header">
                  <div>
                    <strong>Pièces / consommables utilisés</strong>
                    <small>Sélection depuis le stock disponible. Les pièces marquées ★ sont recommandées selon le service sélectionné.</small>
                  </div>

                  <button
                    type="button"
                    className="wo-secondary-btn"
                    onClick={addPartRow}
                    disabled={recommendedStockItems.length === 0}
                  >
                    + Ajouter une pièce
                  </button>
                </div>

                {availableStockItems.length === 0 && (
                  <p className="wo-muted">Aucune pièce disponible en stock.</p>
                )}

                {formPartRows.length > 0 && (
                  <div className="wo-parts-list">
                    {formPartRows.map((part, index) => (
                      <div className="wo-part-row" key={`${part.stock_item_id || 'custom'}-${index}`}>
                        <select
                          value={part.stock_item_id || ''}
                          onChange={(event) => updatePartRow(index, { stock_item_id: event.target.value })}
                        >
                          {recommendedStockItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              ★ {item.name} · stock {item.quantity} · {formatMoney(item.unit_price)}
                            </option>
                          ))}

                          {availableStockItems
                            .filter((item) => !recommendedStockItems.some((recommended) => Number(recommended.id) === Number(item.id)))
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} · stock {item.quantity} · {formatMoney(item.unit_price)}
                              </option>
                            ))}
                        </select>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={part.quantity}
                          onChange={(event) => updatePartRow(index, { quantity: event.target.value })}
                          aria-label="Quantité pièce"
                        />

                        <strong>{formatMoney(part.total_amount)}</strong>

                        <button type="button" className="wo-danger-light" onClick={() => removePartRow(index)}>
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="wo-parts-total">
                  <span>Total pièces sélectionnées</span>
                  <strong>{formatMoney(formPartsTotal)}</strong>
                </div>
              </div>

              <label>
                Acompte / montant déjà payé
                <input
                  type="number"
                  min="0"
                  value={form.paid_amount}
                  onChange={(event) => patchForm({ paid_amount: event.target.value })}
                  placeholder="0"
                />
                <small>À ne pas confondre avec paiement en espèces.</small>
              </label>

              <label className="wo-full">
                Description / panne constatée
                <textarea
                  value={form.description}
                  onChange={(event) => patchForm({ description: event.target.value })}
                  placeholder="Décrire la demande client, les symptômes, les travaux proposés ou réalisés…"
                  rows="4"
                />
              </label>
            </div>

            <div className="wo-total-preview">
              <div>
                <span>Total estimatif</span>
                <small>
                  Main-d’œuvre : {formatMoney(formLabor)} · Coût pièces détachées : {formatMoney(formParts)} · Acompte : {formatMoney(formPaid)}
                </small>
              </div>
              <div className="wo-total-amount">
                <strong>{formatMoney(formTotal)}</strong>
                <small>Reste à payer : {formatMoney(formBalance)}</small>
              </div>
            </div>

            <button className="wo-primary" type="submit" disabled={loading}>
              {editingId ? 'Enregistrer les modifications' : 'Créer le dossier'}
            </button>
          </form>
        </main>
      </section>
    </div>
  )
}

function StatCard({ label, value, hint, accent }) {
  return (
    <div className={`wo-stat-card ${accent ? 'accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  )
}

function Info({ label, value, strong }) {
  return (
    <div className={`wo-info ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
