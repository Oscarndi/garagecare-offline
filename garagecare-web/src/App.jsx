import { useEffect, useMemo, useState } from 'react'
import './App.css'
import ClientsModule from './pages/ClientsModule.jsx'
import VehiclesModule from './pages/VehiclesModule.jsx'
import ServicesModule from './pages/ServicesModule.jsx'
import WorkOrdersModule from './pages/WorkOrdersModule.jsx'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const LOGO = '/assets/garagecare/icone_garage.png'

const navItems = [
  ['dashboard', '▦', 'Tableau de bord'],
  ['clients', '♙', 'Clients'],
  ['vehicles', '▰', 'Véhicules'],
  ['services', '⌘', 'Services'],
  ['quotes', '▤', 'Devis'],
  ['planning', '▣', 'Planning'],
  ['stock', '⬡', 'Stock'],
  ['expenses', 'ⓕ', 'Charges'],
  ['assistant', '☷', 'Assistant'],
  ['users', '♙', 'Utilisateurs'],
  ['pwa', '⌁', 'PWA'],
]

const subtitles = {
  dashboard: "Vue rapide de l'activité du garage",
  clients: 'Recherche rapide par nom ou téléphone',
  vehicles: 'Parc véhicules lié aux clients',
  services: "Services actifs utilisés par les devis et l'assistant",
  quotes: 'Sélection client + véhicule + services, calcul contrôlé',
  planning: 'Planning annuel, mensuel, hebdomadaire, journalier et horaire',
  stock: 'Alertes sur quantités basses',
  expenses: "Suivi simple de l'activité économique",
  assistant: 'Collecter une demande et orienter sans diagnostic définitif',
  users: 'Gestion simple des comptes internes',
  pwa: 'Installation, badge connexion, brouillons locaux',
}

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('garagecare_token') || '')
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const api = useMemo(() => {
    return async function request(path, options = {}) {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Erreur API')
      return data
    }
  }, [token])

  async function logout() {
    try {
      await api('/logout', { method: 'POST' })
    } catch {
      // sortie locale
    }

    localStorage.removeItem('garagecare_token')
    setToken('')
    setUser(null)
  }

  if (!token) return <LoginPage setToken={setToken} />

  return (
    <div className="gc-shell">
      <aside className="gc-sidebar">
        <div className="gc-brand">
          <img src={LOGO} alt="GarageCare" />
          <div>
            <strong>Garage<span>Care</span></strong>
            <small>OFFLINE</small>
          </div>
        </div>

        <nav className="gc-nav">
          {navItems.map(([key, icon, label]) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)}>
              <i>{icon}</i>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="local-pill">
          <img src={LOGO} alt="" />
          <span>Mode local prêt</span>
          <b />
        </div>
      </aside>

      <main className="gc-main">
        <header className="gc-topbar">
          <div>
            <h1>{navItems.find(([key]) => key === page)?.[2]}</h1>
            <p>{subtitles[page]}</p>
          </div>

          <div className="gc-top-actions">
            <span className="pill online"><b />{online ? 'En ligne' : 'Hors ligne'}</span>
            <span className="pill admin">♙ {user?.role || 'Admin'}</span>
            <button className="logout" onClick={logout}>Sortir</button>
          </div>
        </header>

        {page === 'dashboard' && <DashboardModel api={api} setUser={setUser} />}
        {page === 'clients' && <ClientsModule api={api} />}
        {page === 'vehicles' && <VehiclesModule api={api} />}
        {page === 'services' && <ServicesModule api={api} />}
        {page === 'quotes' && <WorkOrdersModule api={api} />}
        {page === 'planning' && <Planning api={api} />}
        {page === 'stock' && <Stock api={api} />}
        {page === 'expenses' && <Expenses api={api} />}
        {page === 'assistant' && <Assistant api={api} />}
        {page === 'users' && <Users api={api} user={user} />}
        {page === 'pwa' && <Pwa />}
      </main>
    </div>
  )
}

function LoginPage({ setToken }) {
  const [email, setEmail] = useState('admin@garagecare.local')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Connexion impossible')

      localStorage.setItem('garagecare_token', data.token)
      setToken(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <img src={LOGO} alt="GarageCare" />
          <div>
            <h1>Garage<span>Care</span></h1>
            <p>Offline</p>
          </div>
        </div>

        <h2>Connexion au garage</h2>
        <p>Accès administrateur ou agent. Fonctionnement PWA après installation.</p>

        <form onSubmit={submit}>
          <label>Email professionnel</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />

          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />

          {error && <Notice type="danger" text={error} />}
          <button className="primary">{busy ? 'Connexion...' : 'Se connecter →'}</button>
        </form>
      </section>

      <section className="pwa-card">
        <h2>PWA offline-first</h2>
        <Feature title="Icône sur bureau" text="Accès rapide depuis votre écran d’accueil." />
        <Feature title="Catalogue consultable hors connexion" text="Vos données disponibles après première visite." />
        <Feature title="Brouillons locaux" text="Travaillez même avec une connexion instable." />
        <div className="secure">Vos données restent sécurisées sur votre appareil.</div>
      </section>
    </main>
  )
}

function Dashboard({ api, setUser }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api('/me'), api('/dashboard')])
      .then(([me, dashboard]) => {
        setUser(me.data)
        setData(dashboard.data)
      })
      .catch((err) => setError(err.message))
  }, [api, setUser])

  if (error) return <Notice type="danger" text={error} />
  if (!data) return <Panel title="Chargement">Chargement du tableau de bord...</Panel>

  return (
    <>
      <div className="stats-grid">
        <Stat icon="♙" label="Clients" value={data.customers_count} hint="Clients suivis" />
        <Stat icon="▰" label="Véhicules" value={data.vehicles_count} hint="Historique lié" />
        <Stat icon="▤" label="Devis en cours" value={data.work_orders_open_count} hint="Proposés ou ouverts" accent />
        <Stat icon="⬡" label="Stock faible" value={data.low_stock_count} hint="Alerte consommables" warn />
      </div>

      <div className="two-grid">
        <Panel title="Viabilité économique">
          <Metric label="Recettes estimées" value={money(data.estimated_revenue)} good />
          <Metric label="Charges" value={money(data.expenses_total)} bad />
          <Metric label="Solde" value={money(data.estimated_balance)} />
          {data.estimated_balance < 0 && <Notice type="warning" text="Les charges dépassent les recettes estimées." />}
        </Panel>

        <Panel title="Rendez-vous du jour">
          <Feature title="Backend validé" text="Login, clients, véhicules, devis, stock, charges et assistant fonctionnent." />
          <Feature title="Interface connectée" text="Les écrans lisent les données réelles de Laravel." />
        </Panel>
      </div>
    </>
  )
}


function Clients({ api }) {
  const emptyForm = { name: '', phone: '', address: '', notes: '' }

  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(query = search) {
    setLoading(true)
    setError('')

    try {
      const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''
      const response = await api(`/customers${suffix}`)
      setItems(response.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load(search)
    }, 250)

    return () => clearTimeout(timer)
  }, [search, api])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function openEdit(customer) {
    setEditingId(customer.id)
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    })
    setMessage('')
    setError('')
    setShowForm(true)
  }

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      if (editingId) {
        await api(`/customers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        })
        setMessage('Client modifié avec succès.')
      } else {
        await api('/customers', {
          method: 'POST',
          body: JSON.stringify(form),
        })
        setMessage('Client enregistré avec succès.')
      }

      setForm(emptyForm)
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(customer) {
    const ok = window.confirm(`Supprimer le client ${customer.name} ?`)
    if (!ok) return

    setMessage('')
    setError('')

    try {
      await api(`/customers/${customer.id}`, { method: 'DELETE' })
      setMessage('Client supprimé avec succès.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Panel>
        <div className="clients-toolbar">
          <div className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un client par nom ou téléphone..."
            />
          </div>

          <button className="primary new-client-button" onClick={openCreate}>
            + Nouveau client
          </button>
        </div>
      </Panel>

      {(message || error) && (
        <Notice type={error ? 'danger' : 'info'} text={error || message} />
      )}

      {showForm && (
        <Panel title={editingId ? 'Modifier le client' : 'Nouveau client'}>
          <form onSubmit={submit} className="client-form-grid">
            <input
              placeholder="Nom"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />

            <input
              placeholder="Téléphone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />

            <input
              placeholder="Adresse"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />

            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />

            <div className="client-form-actions">
              <button className="primary">
                {editingId ? 'Enregistrer les modifications' : 'Enregistrer le client'}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  setForm(emptyForm)
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel>
        <div className="clients-list-header">
          <h2>Liste des clients</h2>
          <span>{items.length} client{items.length > 1 ? 's' : ''}</span>
          <button className="secondary-button" onClick={openCreate}>+ Ajouter</button>
        </div>

        {loading ? (
          <div className="empty">Chargement des clients...</div>
        ) : items.length === 0 ? (
          <div className="empty">Aucun client trouvé. Ajoutez le premier client ou modifiez votre recherche.</div>
        ) : (
          <div className="clients-table-wrap">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>Véhicules</th>
                  <th>Adresse</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="client-identity">
                        <span className="client-avatar">
                          {(customer.name || '?').trim().slice(0, 1).toUpperCase()}
                        </span>
                        <strong>{customer.name}</strong>
                      </div>
                    </td>

                    <td>☎ {customer.phone}</td>
                    <td>▰ {customer.vehicles_count ?? 0}</td>
                    <td>{customer.address || '—'}</td>

                    <td>
                      <div className="row-actions">
                        <button className="mini-button" onClick={() => openEdit(customer)}>Modifier</button>
                        <button className="mini-button danger" onClick={() => remove(customer)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Notice text="UX : recherchez, ajoutez, modifiez ou supprimez un client. Les résultats viennent directement de l’API Laravel." />
    </>
  )
}


function Vehicles({ api }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    api('/vehicles').then((response) => setRows(response.data))
  }, [api])

  return (
    <Panel title="Parc véhicules">
      <Table rows={rows} columns={[
        ['registration_number', 'Immatriculation'],
        ['brand', 'Marque'],
        ['model', 'Modèle'],
        ['mileage', 'Kilométrage'],
        ['fuel_type', 'Carburant'],
      ]} />
    </Panel>
  )
}

function Services({ api }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    api('/services?active_only=1').then((response) => setItems(response.data))
  }, [api])

  return (
    <>
      <div className="service-grid">
        {items.map((service) => (
          <article className="service-card" key={service.id}>
            <div className="service-icon">⌘</div>
            <h2>{service.name}</h2>
            <p>{service.category}</p>
            <hr />
            <div className="service-meta">
              <span>◷ {service.estimated_duration || 0} min</span>
              <strong>{Number(service.estimated_price).toLocaleString('fr-FR')}<small> FCFA</small></strong>
            </div>
            <small>{service.advice}</small>
          </article>
        ))}
      </div>
      <Notice text="Principe assistant : le chatbot ne recommande que les services actifs du catalogue." />
    </>
  )
}

function Quotes({ api }) {
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [services, setServices] = useState([])
  const [orders, setOrders] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    customer_id: '',
    vehicle_id: '',
    problem_description: '',
    scheduled_at: '2026-07-07 09:30:00',
    services: [],
  })

  function load() {
    Promise.all([
      api('/customers'),
      api('/vehicles'),
      api('/services?active_only=1'),
      api('/work-orders'),
    ]).then(([customersResponse, vehiclesResponse, servicesResponse, ordersResponse]) => {
      setCustomers(customersResponse.data)
      setVehicles(vehiclesResponse.data)
      setServices(servicesResponse.data)
      setOrders(ordersResponse.data)

      setForm((current) => ({
        ...current,
        customer_id: current.customer_id || customersResponse.data[0]?.id || '',
        vehicle_id: current.vehicle_id || vehiclesResponse.data[0]?.id || '',
        services: current.services.length ? current.services : [servicesResponse.data[0]?.id].filter(Boolean),
      }))
    })
  }

  useEffect(load, [api])

  const total = services
    .filter((service) => form.services.includes(service.id))
    .reduce((sum, service) => sum + Number(service.estimated_price), 0)

  async function save(event) {
    event.preventDefault()

    try {
      await api('/work-orders', {
        method: 'POST',
        body: JSON.stringify({ ...form, status: 'propose' }),
      })
      setMessage('Devis enregistré avec succès.')
      load()
    } catch (err) {
      setMessage(err.message)
    }
  }

  function toggleService(id) {
    setForm((current) => ({
      ...current,
      services: current.services.includes(id)
        ? current.services.filter((serviceId) => serviceId !== id)
        : [...current.services, id],
    }))
  }

  return (
    <div className="two-grid">
      <Panel title="Nouveau devis">
        <form onSubmit={save}>
          <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>

          <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: Number(e.target.value) })}>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number} — {vehicle.brand} {vehicle.model}
              </option>
            ))}
          </select>

          <input placeholder="Problème" value={form.problem_description} onChange={(e) => setForm({ ...form, problem_description: e.target.value })} />
          <input value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />

          <div className="check-list">
            {services.map((service) => (
              <label key={service.id}>
                <input type="checkbox" checked={form.services.includes(service.id)} onChange={() => toggleService(service.id)} />
                {service.name} — {money(service.estimated_price)}
              </label>
            ))}
          </div>

          <button className="primary">▤ Enregistrer le devis</button>
        </form>

        {message && <Notice text={message} />}
      </Panel>

      <Panel title="Résumé estimatif">
        <div className="quote-total">{money(total)}</div>
        <Notice type="warning" text="Devis estimatif, non facture." />
        <h3>Historique interventions</h3>
        <Table rows={orders.slice(0, 5)} columns={[
          ['id', '#'],
          ['status', 'Statut'],
          ['estimated_amount', 'Montant'],
        ]} />
      </Panel>
    </div>
  )
}

function Planning({ api }) {
  const [orders, setOrders] = useState([])
  const [me, setMe] = useState(null)
  const [planningUsers, setPlanningUsers] = useState([])
  const [assigningResponsible, setAssigningResponsible] = useState(false)
  const [responsibleMessage, setResponsibleMessage] = useState('')
  const [view, setView] = useState('month')
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [hourFocus, setHourFocus] = useState('09')
  const [statusFilter, setStatusFilter] = useState('all')
  const [responsibleFilter, setResponsibleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      api('/work-orders'),
      api('/me').catch(() => null),
      api('/users').catch(() => []),
    ])
      .then(([workOrdersResponse, meResponse, usersResponse]) => {
        if (!active) return

        const payload = workOrdersResponse?.data ?? workOrdersResponse
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
        setOrders(rows)

        const mePayload = meResponse?.data ?? meResponse
        setMe(mePayload?.user || mePayload || null)

        const usersPayload = usersResponse?.data ?? usersResponse
        const userRows = Array.isArray(usersPayload) ? usersPayload : Array.isArray(usersPayload?.data) ? usersPayload.data : []
        setPlanningUsers(userRows)

        if (!selectedId && rows.length > 0) {
          const first = rows.find((order) => order.scheduled_at) || rows[0]
          setSelectedId(first.id)
        }
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Impossible de charger le planning.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [api])

  const pad = (value) => String(value).padStart(2, '0')
  const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`

  function toDate(value) {
    if (!value) return null
    const raw = String(value)
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  }

  function anchor() {
    return new Date(`${anchorDate}T12:00:00`)
  }

  function startOfWeek(date) {
    const copy = new Date(date)
    const day = copy.getDay() || 7
    copy.setDate(copy.getDate() - day + 1)
    copy.setHours(12, 0, 0, 0)
    return copy
  }

  function addDays(date, days) {
    const copy = new Date(date)
    copy.setDate(copy.getDate() + days)
    return copy
  }

  function addMonths(date, months) {
    const copy = new Date(date)
    copy.setMonth(copy.getMonth() + months)
    return copy
  }

  function addYears(date, years) {
    const copy = new Date(date)
    copy.setFullYear(copy.getFullYear() + years)
    return copy
  }

  function labelStatus(status) {
    const labels = {
      brouillon: 'Brouillon',
      propose: 'Proposé',
      accepte: 'Accepté',
      prevu: 'Prévu',
      en_cours: 'En cours',
      termine: 'Terminé',
      annule: 'Annulé',
    }
    return labels[status] || status || 'Sans statut'
  }

  function labelDate(value) {
    const date = toDate(value)
    if (!date) return 'Non planifié'
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function labelDay(date) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
  }

  function labelMonth(date) {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  function titleOf(order) {
    return order?.title || order?.problem_description || order?.description || `Intervention #${order?.id}`
  }

  function customerOf(order) {
    return order?.customer?.name || order?.customer_name || (order?.customer_id ? `Client #${order.customer_id}` : 'Client non renseigné')
  }

  function vehicleOf(order) {
    const vehicle = order?.vehicle
    if (vehicle?.registration_number) return vehicle.registration_number
    if (vehicle?.plate_number) return vehicle.plate_number
    if (vehicle?.brand || vehicle?.model) return `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()
    return order?.vehicle_id ? `Véhicule #${order.vehicle_id}` : 'Véhicule non renseigné'
  }

  function responsibleOf(order) {
    const linkedUser = order?.user || order?.assigned_user || planningUsers.find((user) => Number(user.id) === Number(order?.user_id))
    if (linkedUser?.name) return linkedUser.name
    if (linkedUser?.email) return linkedUser.email
    if (me?.id && Number(order?.user_id) === Number(me.id)) return me.name || me.email || `Responsable #${order.user_id}`
    if (order?.user_id) return `Responsable #${order.user_id}`
    return 'Non assigné'
  }

  function totalOf(order) {
    return Number(order?.total_amount || order?.estimated_amount || 0)
  }

  function paidOf(order) {
    return Number(order?.paid_amount || 0)
  }

  function isLate(order, date) {
    if (!date || ['termine', 'annule'].includes(order?.status)) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  function enrich(order) {
    const date = toDate(order.scheduled_at)
    return {
      ...order,
      _date: date,
      _dateKey: date ? dateKey(date) : 'unscheduled',
      _monthKey: date ? monthKey(date) : 'unscheduled',
      _hour: date ? pad(date.getHours()) : '--',
      _title: titleOf(order),
      _customer: customerOf(order),
      _vehicle: vehicleOf(order),
      _responsible: responsibleOf(order),
      _total: totalOf(order),
      _paid: paidOf(order),
      _late: isLate(order, date),
    }
  }

  const enriched = orders.map(enrich)

  const filtered = enriched.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false
    if (responsibleFilter === 'assigned' && !order.user_id) return false
    if (responsibleFilter === 'unassigned' && order.user_id) return false
    if (responsibleFilter === 'me' && (!me?.id || Number(order.user_id) !== Number(me.id))) return false

    const term = search.trim().toLowerCase()
    if (!term) return true

    return [
      order._title,
      order._customer,
      order._vehicle,
      order._responsible,
      order.status,
      String(order.id),
    ].join(' ').toLowerCase().includes(term)
  })

  const scheduled = filtered.filter((order) => order._date).sort((a, b) => a._date - b._date)
  const unscheduled = filtered.filter((order) => !order._date)
  const selectedOrder = enriched.find((order) => String(order.id) === String(selectedId)) || scheduled[0] || unscheduled[0]

  const current = anchor()
  const currentYear = current.getFullYear()
  const currentMonth = current.getMonth()
  const currentDayKey = dateKey(current)
  const currentMonthKey = monthKey(current)
  const weekStart = startOfWeek(current)

  const yearOrders = scheduled.filter((order) => order._date.getFullYear() === currentYear)
  const monthOrders = scheduled.filter((order) => order._monthKey === currentMonthKey)
  const weekOrders = scheduled.filter((order) => {
    const diff = Math.floor((order._date - weekStart) / 86400000)
    return diff >= 0 && diff < 7
  })
  const dayOrders = scheduled.filter((order) => order._dateKey === currentDayKey)
  const hourOrders = dayOrders.filter((order) => order._hour === hourFocus)

  const activeOrders =
    view === 'year' ? yearOrders :
    view === 'month' ? monthOrders :
    view === 'week' ? weekOrders :
    view === 'day' ? dayOrders :
    hourOrders

  function stats(list) {
    return {
      count: list.length,
      done: list.filter((order) => order.status === 'termine').length,
      late: list.filter((order) => order._late).length,
      revenue: list.reduce((sum, order) => sum + order._total, 0),
    }
  }

  const activeStats = stats(activeOrders)

  function goToday() {
    const now = new Date()
    setAnchorDate(dateKey(now))
    setHourFocus(pad(now.getHours()))
  }

  function move(delta) {
    const base = anchor()
    let next = base

    if (view === 'year') next = addYears(base, delta)
    if (view === 'month') next = addMonths(base, delta)
    if (view === 'week') next = addDays(base, delta * 7)
    if (view === 'day') next = addDays(base, delta)
    if (view === 'hour') {
      setHourFocus(pad(Math.max(0, Math.min(23, Number(hourFocus) + delta))))
      next = base
    }

    setAnchorDate(dateKey(next))
  }

  async function assignResponsibleFromPlanning(userId) {
    if (!selectedOrder?.id) return

    setAssigningResponsible(true)
    setResponsibleMessage('')

    try {
      const response = await api(`/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          user_id: userId ? Number(userId) : null,
        }),
      })

      const updated = response?.data ?? response

      setOrders((current) => current.map((order) => {
        if (Number(order.id) !== Number(selectedOrder.id)) return order
        return { ...order, ...updated }
      }))

      setResponsibleMessage('Responsable affecté à la tâche.')
    } catch (err) {
      setResponsibleMessage(err?.message || 'Impossible d’affecter ce responsable.')
    } finally {
      setAssigningResponsible(false)
    }
  }

  function renderTask(order, compact = false) {
    return (
      <button key={order.id} type="button" className={`planning-task-card ${order._late ? 'late' : ''}`} onClick={() => setSelectedId(order.id)}>
        <span className="planning-task-time">{order._date ? `${pad(order._date.getHours())}:${pad(order._date.getMinutes())}` : 'Sans date'}</span>
        <strong>{order._title}</strong>
        {!compact && <span>{order._customer} · {order._vehicle}</span>}
        <span>Resp. {order._responsible}</span>
        <em>{labelStatus(order.status)} · {money(order._total)}</em>
      </button>
    )
  }

  function renderYear() {
    return (
      <div className="planning-year-grid">
        {Array.from({ length: 12 }, (_, index) => {
          const monthDate = new Date(currentYear, index, 1, 12)
          const list = scheduled.filter((order) => order._date.getFullYear() === currentYear && order._date.getMonth() === index)
          const monthStats = stats(list)

          return (
            <button key={index} type="button" className="planning-month-card" onClick={() => { setAnchorDate(dateKey(monthDate)); setView('month') }}>
              <strong>{monthDate.toLocaleDateString('fr-FR', { month: 'long' })}</strong>
              <span>{monthStats.count} activité(s)</span>
              <small>{monthStats.done} terminée(s) · {monthStats.late} retard</small>
              <em>{money(monthStats.revenue)}</em>
            </button>
          )
        })}
      </div>
    )
  }

  function renderMonth() {
    const first = new Date(currentYear, currentMonth, 1, 12)
    const gridStart = startOfWeek(first)
    const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))

    return (
      <div className="planning-month-grid">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label) => <div key={label} className="planning-weekday">{label}</div>)}

        {days.map((day) => {
          const key = dateKey(day)
          const list = scheduled.filter((order) => order._dateKey === key)
          const outside = day.getMonth() !== currentMonth
          const isToday = key === dateKey(new Date())

          return (
            <button key={key} type="button" className={`planning-day-cell ${outside ? 'muted' : ''} ${isToday ? 'today' : ''}`} onClick={() => { setAnchorDate(key); setView('day') }}>
              <strong>{day.getDate()}</strong>
              <span>{list.length} tâche(s)</span>
              {list.slice(0, 2).map((order) => <small key={order.id}>{pad(order._date.getHours())}:{pad(order._date.getMinutes())} · {order._title}</small>)}
              {list.length > 2 && <small>+{list.length - 2} autre(s)</small>}
            </button>
          )
        })}
      </div>
    )
  }

  function renderWeek() {
    return (
      <div className="planning-week-grid">
        {Array.from({ length: 7 }, (_, index) => {
          const day = addDays(weekStart, index)
          const key = dateKey(day)
          const list = scheduled.filter((order) => order._dateKey === key)

          return (
            <div key={key} className="planning-day-column">
              <header><strong>{labelDay(day)}</strong><span>{list.length} activité(s)</span></header>
              {list.length ? list.map((order) => renderTask(order)) : <p className="planning-empty">Aucune tâche</p>}
            </div>
          )
        })}
      </div>
    )
  }

  function renderDay() {
    const baseHours = Array.from({ length: 13 }, (_, index) => 7 + index)
    const extraHours = dayOrders.map((order) => Number(order._hour)).filter((hour) => Number.isFinite(hour))
    const hours = Array.from(new Set([...baseHours, ...extraHours])).sort((a, b) => a - b)

    return (
      <div className="planning-hour-list">
        {hours.map((hour) => {
          const hourKey = pad(hour)
          const list = dayOrders.filter((order) => order._hour === hourKey)

          return (
            <div key={hourKey} className="planning-hour-row">
              <button type="button" className="planning-hour-label" onClick={() => { setHourFocus(hourKey); setView('hour') }}>{hourKey}:00</button>
              <div className="planning-hour-content">
                {list.length ? list.map((order) => renderTask(order)) : <span>Aucune activité programmée</span>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderHour() {
    return (
      <div className="planning-hour-focus">
        <label>
          Créneau horaire
          <select value={hourFocus} onChange={(event) => setHourFocus(event.target.value)}>
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={pad(hour)}>{pad(hour)}:00</option>)}
          </select>
        </label>

        {hourOrders.length ? hourOrders.map((order) => renderTask(order)) : <p className="planning-empty">Aucune activité sur ce créneau.</p>}
      </div>
    )
  }

  function renderActiveView() {
    if (view === 'year') return renderYear()
    if (view === 'month') return renderMonth()
    if (view === 'week') return renderWeek()
    if (view === 'day') return renderDay()
    return renderHour()
  }

  return (
    <div className="planning-pro">
      <div className="planning-hero">
        <div>
          <p className="planning-kicker">Planning GarageCare</p>
          <h2>Planification annuelle, mensuelle, hebdomadaire, journalière et horaire</h2>
          <p>Détail des activités programmées, responsables, clients, véhicules, statuts et montants.</p>
        </div>

        <div className="planning-nav">
          <button type="button" onClick={() => move(-1)}>‹ Précédent</button>
          <button type="button" onClick={goToday}>Aujourd’hui</button>
          <button type="button" onClick={() => move(1)}>Suivant ›</button>
        </div>
      </div>

      <div className="planning-toolbar">
        <div className="planning-mode-tabs">
          {[
            ['year', 'Vue Année'],
            ['month', 'Vue Mois'],
            ['week', 'Vue Semaine'],
            ['day', 'Vue Jour'],
            ['hour', 'Vue Heure'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
          ))}
        </div>

        <div className="planning-date-controls">
          <label>Date repère<input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} /></label>
          <label>
            Statut
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tous</option>
              <option value="brouillon">Brouillon</option>
              <option value="propose">Proposé</option>
              <option value="accepte">Accepté</option>
              <option value="prevu">Prévu</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="annule">Annulé</option>
            </select>
          </label>
          <label>
            Responsable
            <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}>
              <option value="all">Tous</option>
              <option value="assigned">Assigné</option>
              <option value="unassigned">Non assigné</option>
              <option value="me">Moi</option>
            </select>
          </label>
          <label>Recherche<input type="search" placeholder="Client, véhicule, tâche..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
      </div>

      <div className="planning-summary-grid">
        <div><strong>{activeStats.count}</strong><span>Activités période</span></div>
        <div><strong>{activeStats.done}</strong><span>Terminées</span></div>
        <div><strong>{activeStats.late}</strong><span>En retard</span></div>
        <div><strong>{money(activeStats.revenue)}</strong><span>CA planifié</span></div>
      </div>

      <div className="planning-period-title">
        <h3>
          {view === 'year' && currentYear}
          {view === 'month' && labelMonth(current)}
          {view === 'week' && `Semaine du ${labelDay(weekStart)}`}
          {view === 'day' && labelDay(current)}
          {view === 'hour' && `${labelDay(current)} · ${hourFocus}:00`}
        </h3>
        <span>{loading ? 'Chargement...' : `${filtered.length} dossier(s) filtré(s)`}</span>
      </div>

      {error && <div className="notice danger">{error}</div>}

      <div className="planning-layout">
        <section className="planning-main-board">
          {loading ? <p className="planning-empty">Chargement du planning...</p> : renderActiveView()}

          {unscheduled.length > 0 && (
            <div className="planning-unscheduled">
              <h3>À planifier</h3>
              <p>Ces dossiers n’ont pas encore de date et d’heure.</p>
              <div className="planning-unscheduled-list">{unscheduled.map((order) => renderTask(order, true))}</div>
            </div>
          )}
        </section>

        <aside className="planning-detail-card">
          <h3>Détail activité</h3>

          {selectedOrder ? (
            <>
              <strong>{selectedOrder._title}</strong>
              <span className="planning-status-pill">{labelStatus(selectedOrder.status)}</span>
              <dl>
                <div><dt>Horaire</dt><dd>{labelDate(selectedOrder.scheduled_at)}</dd></div>
                <div><dt>Responsable</dt><dd>{selectedOrder._responsible}</dd></div>
                <div>
                  <dt>Affecter à</dt>
                  <dd>
                    <select
                      value={selectedOrder.user_id || ''}
                      disabled={assigningResponsible}
                      onChange={(event) => assignResponsibleFromPlanning(event.target.value)}
                    >
                      <option value="">Non assigné</option>
                      {planningUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email || `Utilisateur #${user.id}`}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div><dt>Client</dt><dd>{selectedOrder._customer}</dd></div>
                <div><dt>Véhicule</dt><dd>{selectedOrder._vehicle}</dd></div>
                <div><dt>Montant</dt><dd>{money(selectedOrder._total)}</dd></div>
                <div><dt>Payé</dt><dd>{money(selectedOrder._paid)}</dd></div>
                <div><dt>Reste</dt><dd>{money(Math.max(0, selectedOrder._total - selectedOrder._paid))}</dd></div>
              </dl>
              {selectedOrder.description && <p>{selectedOrder.description}</p>}
              {selectedOrder.problem_description && <p>{selectedOrder.problem_description}</p>}
              {selectedOrder._late && <div className="planning-late-warning">Retard à traiter ou à reprogrammer.</div>}
              {responsibleMessage && <div className="planning-detail-note">{responsibleMessage}</div>}
              <div className="planning-detail-note">Le responsable sélectionné apparaît dans le planning et dans la fiche intervention du véhicule.</div>
            </>
          ) : (
            <p>Aucune activité sélectionnée.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function Stock({ api }) {
  const [rows, setRows] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [stockHistoryMessage, setStockHistoryMessage] = useState('')
  const [stockHistoryLoaded, setStockHistoryLoaded] = useState(false)

  useEffect(() => {
    let active = true

    api('/stock-items')
      .then((response) => {
        if (!active) return
        const data = response && response.data
        setRows(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (active) setRows([])
      })

    return () => {
      active = false
    }
  }, [api])

  async function loadStockMovementHistory() {
    setStockHistoryMessage('Chargement de l’historique...')
    setStockHistoryLoaded(true)

    try {
      const response = await api('/stock-movements?limit=40')
      const data = response && response.data
      const list = Array.isArray(data) ? data : []

      setStockMovements(list)
      setStockHistoryMessage(list.length ? '' : 'Aucun mouvement de stock enregistré.')
    } catch (error) {
      setStockMovements([])
      setStockHistoryMessage('Historique indisponible pour le moment.')
    }
  }

  function safeText(value, fallback = '—') {
    if (value === null || value === undefined || value === '') return fallback
    return String(value)
  }

  function movementType(movement) {
    const delta = Number(movement && movement.quantity_delta ? movement.quantity_delta : 0)
    if (movement && movement.type === 'work_order_return') return 'Retour stock'
    if (delta > 0) return 'Retour stock'
    return 'Sortie stock'
  }

  return (
    <>
      <Panel title="Articles en stock">
        <Table rows={rows} columns={[
          ['name', 'Nom'],
          ['category', 'Catégorie'],
          ['quantity', 'Quantité'],
          ['alert_threshold', 'Seuil'],
          ['unit_price', 'Prix estimé'],
        ]} />
      </Panel>

      <Panel title="Historique des mouvements de stock">
        <button type="button" onClick={loadStockMovementHistory}>
          Charger / actualiser l’historique
        </button>

        {stockHistoryMessage && <p>{stockHistoryMessage}</p>}

        {stockHistoryLoaded && stockMovements.length > 0 && (
          <div>
            {stockMovements.map((movement, index) => (
              <div key={safeText(movement && movement.id, index)}>
                <strong>
                  {movementType(movement)}
                  {' · '}
                  {safeText(movement && movement.stock_item_name, 'Article non indiqué')}
                </strong>
                <p>
                  Intervention #{safeText(movement && movement.work_order_id)}
                  {' · '}
                  {safeText(movement && movement.user_name, 'Responsable non indiqué')}
                </p>
                <p>
                  Delta {safeText(movement && movement.quantity_delta, '0')}
                  {' · Stock '}
                  {safeText(movement && movement.quantity_before)}
                  {' → '}
                  {safeText(movement && movement.quantity_after)}
                </p>
                <small>{safeText(movement && movement.created_at, 'Date non disponible')}</small>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}

function Expenses({ api }) {
  const categories = [
    'eau',
    'électricité',
    'salaire',
    'loyer',
    'emprunt',
    'achat pièces',
    'transport',
    'entretien atelier',
    'impôt / taxe',
    'autre',
  ]

  const today = new Date().toISOString().slice(0, 10)
  const emptyForm = {
    label: '',
    category: 'eau',
    amount: '',
    expense_date: today,
    notes: '',
  }

  const [rows, setRows] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function listFromResponse(response) {
    const payload = response?.data ?? response
    return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
  }

  function dateFr(value) {
    if (!value) return '—'
    const normalized = String(value).slice(0, 10)
    const date = new Date(`${normalized}T12:00:00`)
    return Number.isNaN(date.getTime()) ? normalized : date.toLocaleDateString('fr-FR')
  }

  async function loadExpenses() {
    setLoading(true)
    try {
      const response = await api('/expenses')
      setRows(listFromResponse(response))
      setError('')
    } catch (err) {
      setRows([])
      setError(err?.message || 'Impossible de charger les charges.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDashboard() {
    try {
      const response = await api('/dashboard')
      setDashboard(response?.data ?? response)
    } catch {
      setDashboard(null)
    }
  }

  useEffect(() => {
    loadExpenses()
    loadDashboard()
  }, [api])

  async function submitExpense(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const payload = {
      label: form.label.trim(),
      category: form.category,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      notes: form.notes.trim(),
    }

    if (!payload.label || !payload.category || !payload.amount || payload.amount <= 0 || !payload.expense_date) {
      setSaving(false)
      setError('Renseignez un libellé, une catégorie, un montant positif et une date.')
      return
    }

    try {
      const response = await api('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const createdPayload = response?.data ?? response
      const created = createdPayload?.data ?? createdPayload

      if (created && created.id) {
        setRows((current) => [created, ...current].slice(0, 100))
      } else {
        await loadExpenses()
      }

      setForm({ ...emptyForm, expense_date: today })
      setMessage('Charge enregistrée avec succès.')
      await loadDashboard()
    } catch (err) {
      setError(err?.message || 'Impossible d’enregistrer la charge.')
    } finally {
      setSaving(false)
    }
  }

  const total = rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const recettes = Number(dashboard?.estimated_revenue || 0)
  const solde = recettes - total
  const latest = rows[0]

  const tableRows = rows.map((expense) => ({
    ...expense,
    expense_date: dateFr(expense.expense_date),
    amount: money(expense.amount),
  }))

  const categoryRows = categories
    .map((category) => {
      const items = rows.filter((expense) => String(expense.category || '').toLowerCase() === category.toLowerCase())
      const amount = items.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      return {
        category,
        nombre: items.length,
        total: money(amount),
        _amount: amount,
      }
    })
    .filter((item) => item.nombre > 0)
    .sort((a, b) => b._amount - a._amount)
    .map(({ _amount, ...item }) => item)

  return (
    <>
      <div className="stats-grid">
        <Stat icon="ⓕ" label="Charges" value={money(total)} hint="Total enregistré" warn />
        <Stat icon="▤" label="Nombre de charges" value={rows.length} hint={loading ? 'Chargement...' : 'Écritures suivies'} />
        <Stat icon="●" label="Solde estimé" value={money(solde)} hint={solde >= 0 ? 'Activité positive' : 'Charges supérieures aux recettes'} accent={solde >= 0} warn={solde < 0} />
        <Stat icon="◇" label="Dernière charge" value={latest ? money(latest.amount) : '—'} hint={latest ? latest.label : 'Aucune charge'} />
      </div>

      {message && <Notice type="success" text={message} />}
      {error && <Notice type="warning" text={error} />}

      <Panel title="Ajouter une charge">
        <form onSubmit={submitExpense}>
          <div className="form-grid">
            <label>
              Libellé
              <input
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder="Ex : Électricité atelier"
                required
              />
            </label>

            <label>
              Catégorie
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                required
              >
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <label>
              Montant
              <input
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="Ex : 45000"
                required
              />
            </label>

            <label>
              Date
              <input
                type="date"
                value={form.expense_date}
                onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
                required
              />
            </label>
          </div>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Détail utile : facture, fournisseur, période concernée..."
              rows="3"
            />
          </label>

          <button type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer la charge'}</button>
        </form>
      </Panel>

      <Panel title="Viabilité économique simple">
        <Metric label="Recettes estimées" value={money(recettes)} good />
        <Metric label="Charges enregistrées" value={money(total)} bad />
        <Metric label="Solde estimé" value={money(solde)} />
        <div className={solde >= 0 ? 'trend-pill good-bg' : 'trend-pill bad-bg'}>
          {solde >= 0 ? '+ Activité positive' : 'Charges supérieures aux recettes'}
        </div>
      </Panel>

      <Panel title="Synthèse par catégorie">
        <Table rows={categoryRows} columns={[
          ['category', 'Catégorie'],
          ['nombre', 'Nombre'],
          ['total', 'Total'],
        ]} />
      </Panel>

      <Panel title="Dernières charges">
        <Table rows={tableRows} columns={[
          ['expense_date', 'Date'],
          ['category', 'Catégorie'],
          ['label', 'Description'],
          ['amount', 'Montant'],
          ['notes', 'Notes'],
        ]} />
      </Panel>
    </>
  )
}

function Assistant({ api }) {
  const [question, setQuestion] = useState('Bonjour, ma voiture fait du bruit quand je freine.')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)

  async function ask(event) {
    event.preventDefault()
    setBusy(true)

    try {
      const response = await api('/assistant/message', {
        method: 'POST',
        body: JSON.stringify({ question }),
      })
      setAnswer(response.data.answer)
    } catch (err) {
      setAnswer(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="two-grid">
      <Panel title="Conversation">
        <div className="chat-bubble user">{question}</div>
        {answer && <div className="chat-bubble bot">{answer}</div>}

        <form onSubmit={ask} className="chat-form">
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="primary">{busy ? 'Analyse...' : 'Envoyer ✈'}</button>
        </form>
      </Panel>

      <Panel title="Fiche demande">
        <Feature title="Intention" text="Détection par règles locales contrôlées." />
        <Feature title="Service recommandé" text="Uniquement si présent et actif dans le catalogue." />
        <Notice type="danger" text="L’assistant doit refuser les demandes hors domaine et ne jamais fournir de diagnostic mécanique définitif." />
      </Panel>
    </div>
  )
}

function Users({ api, user }) {
  const emptyForm = { name: '', email: '', role: 'agent', status: 'actif', password: '' }
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [resetId, setResetId] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin'

  function normalizeRows(payload) {
    const data = payload?.data ?? payload
    return Array.isArray(data) ? data : []
  }

  function countBy(role, status) {
    return rows.filter((item) => item.role === role && (!status || (item.status || 'actif') === status)).length
  }

  function activeAdminCount() {
    return rows.filter((item) => item.role === 'admin' && (item.status || 'actif') === 'actif').length
  }

  function loadUsers() {
    setLoading(true)
    return api('/users')
      .then((payload) => {
        setRows(normalizeRows(payload))
        setError('')
      })
      .catch((err) => {
        setError(err?.message || 'Impossible de charger les utilisateurs.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadUsers()
  }, [api])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setMessage('')
    setError('')
  }

  function editUser(item) {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      email: item.email || '',
      role: item.role || 'agent',
      status: item.status || 'actif',
      password: '',
    })
    setMessage('')
    setError('')
  }

  function canRiskLastAdmin(item, nextStatus = null, nextRole = null) {
    const currentStatus = item?.status || 'actif'
    const currentRole = item?.role || 'agent'
    const status = nextStatus || currentStatus
    const role = nextRole || currentRole
    return currentRole === 'admin' && currentStatus === 'actif' && !(role === 'admin' && status === 'actif') && activeAdminCount() <= 1
  }

  function submitUser(event) {
    event.preventDefault()

    if (!isAdmin) {
      setError('Action réservée aux administrateurs.')
      return
    }

    if (!editingId && !form.password.trim()) {
      setError('Le mot de passe est obligatoire à la création.')
      return
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      status: form.status,
    }

    if (!editingId) {
      payload.password = form.password
    }

    setSaving(true)
    setMessage('')
    setError('')

    api(editingId ? `/users/${editingId}` : '/users', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })
      .then((response) => {
        setMessage(response?.message || (editingId ? 'Utilisateur mis à jour.' : 'Utilisateur créé.'))
        resetForm()
        return loadUsers()
      })
      .catch((err) => {
        setError(err?.message || 'Enregistrement impossible.')
      })
      .finally(() => setSaving(false))
  }

  function toggleStatus(item) {
    if (!isAdmin) {
      setError('Action réservée aux administrateurs.')
      return
    }

    const nextStatus = (item.status || 'actif') === 'actif' ? 'inactif' : 'actif'

    if (canRiskLastAdmin(item, nextStatus, item.role)) {
      setError('Impossible de désactiver le dernier administrateur actif.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    api(`/users/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    })
      .then((response) => {
        setMessage(response?.message || 'Statut utilisateur mis à jour.')
        return loadUsers()
      })
      .catch((err) => setError(err?.message || 'Changement de statut impossible.'))
      .finally(() => setSaving(false))
  }

  function submitResetPassword(event) {
    event.preventDefault()

    if (!isAdmin) {
      setError('Action réservée aux administrateurs.')
      return
    }

    if (!resetId || resetPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    api(`/users/${resetId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: resetPassword }),
    })
      .then((response) => {
        setMessage(response?.message || 'Mot de passe réinitialisé.')
        setResetId(null)
        setResetPassword('')
        return loadUsers()
      })
      .catch((err) => setError(err?.message || 'Réinitialisation impossible.'))
      .finally(() => setSaving(false))
  }

  const tableRows = rows.map((item) => ({
    name: item.name || '—',
    email: item.email || '—',
    role: item.role === 'admin' ? 'Administrateur' : 'Agent',
    statut: (item.status || 'actif') === 'actif' ? 'Actif' : 'Inactif',
  }))

  return (
    <>
      <div className="stats-grid">
        <Stat icon="♙" label="Admins actifs" value={countBy('admin', 'actif')} hint="Accès complet" />
        <Stat icon="♙" label="Agents actifs" value={countBy('agent', 'actif')} hint="Opérations garage" accent />
        <Stat icon="!" label="Comptes inactifs" value={rows.filter((item) => (item.status || 'actif') === 'inactif').length} hint="Accès bloqué" warn />
        <Stat icon="♙" label="Rôle actuel" value={user?.role || 'Admin'} hint="Session connectée" warn />
      </div>

      {message && <Notice text={message} />}
      {error && <Notice type="warning" text={error} />}

      <div className="dashboard-model-panels">
        <Panel title={editingId ? 'Modifier un utilisateur' : 'Créer un utilisateur'}>
          {!isAdmin && <Notice type="warning" text="Votre rôle ne permet pas de gérer les comptes internes." />}
          <form className="form-grid" onSubmit={submitUser}>
            <label>
              Nom
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required disabled={!isAdmin || saving} />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} required disabled={!isAdmin || saving} />
            </label>
            <label>
              Rôle
              <select value={form.role} onChange={(event) => updateForm('role', event.target.value)} disabled={!isAdmin || saving}>
                <option value="admin">Administrateur</option>
                <option value="agent">Agent</option>
              </select>
            </label>
            <label>
              Statut
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} disabled={!isAdmin || saving}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </label>
            {!editingId && (
              <label>
                Mot de passe initial
                <input type="password" value={form.password} onChange={(event) => updateForm('password', event.target.value)} minLength="6" required disabled={!isAdmin || saving} />
              </label>
            )}
            <div className="form-actions">
              <button className="primary" type="submit" disabled={!isAdmin || saving}>
                {editingId ? 'Enregistrer les modifications' : 'Créer le compte'}
              </button>
              {editingId && <button type="button" onClick={resetForm} disabled={saving}>Annuler</button>}
            </div>
          </form>
        </Panel>

        <Panel title="Réinitialiser un mot de passe">
          <form className="form-grid" onSubmit={submitResetPassword}>
            <label>
              Compte
              <select value={resetId || ''} onChange={(event) => setResetId(event.target.value)} disabled={!isAdmin || saving}>
                <option value="">Choisir un utilisateur</option>
                {rows.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} — {item.email}</option>
                ))}
              </select>
            </label>
            <label>
              Nouveau mot de passe
              <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} minLength="6" disabled={!isAdmin || saving} />
            </label>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={!isAdmin || saving || !resetId}>Réinitialiser le mot de passe</button>
            </div>
          </form>
          <Notice text="Les mots de passe existants ne sont jamais affichés." />
        </Panel>
      </div>

      <Panel title="Comptes internes">
        {loading ? (
          <p>Chargement des comptes...</p>
        ) : (
          <Table rows={tableRows} columns={[
            ['name', 'Nom'],
            ['email', 'Email'],
            ['role', 'Rôle'],
            ['statut', 'Statut'],
          ]} />
        )}

        <div className="cards-grid user-actions-grid">
          {rows.map((item) => (
            <div className="service-card" key={item.id}>
              <div className="service-card-head">
                <div className="service-icon">♙</div>
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.email}</p>
                </div>
              </div>
              <p><strong>Rôle :</strong> {item.role === 'admin' ? 'Administrateur' : 'Agent'}</p>
              <p><strong>Statut :</strong> {(item.status || 'actif') === 'actif' ? 'Actif' : 'Inactif'}</p>
              <div className="form-actions">
                <button className="mini-button" onClick={() => editUser(item)} disabled={!isAdmin || saving}>Modifier</button>
                <button className="mini-button" onClick={() => toggleStatus(item)} disabled={!isAdmin || saving || canRiskLastAdmin(item)}>
                  {(item.status || 'actif') === 'actif' ? 'Désactiver' : 'Activer'}
                </button>
                <button className="mini-button" onClick={() => setResetId(item.id)} disabled={!isAdmin || saving}>Reset mot de passe</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Notice text="Principe MVP : deux rôles simples seulement — administrateur et agent — avec protection du dernier administrateur actif." />
    </>
  )
}

function Pwa() {
  return (
    <>
      <div className="two-grid">
        <Panel>
          <div className="pwa-install">
            <img src={LOGO} alt="GarageCare" />
            <h2>Installer GarageCare Offline</h2>
            <p>Ajoutez l’application sur le bureau ou l’écran d’accueil pour un accès rapide.</p>
            <button className="primary">Installer la PWA</button>
          </div>
        </Panel>

        <Panel title="État hors connexion">
          <Feature title="App shell en cache" text="Pages principales ouvertes après première visite." />
          <Feature title="Catalogue local" text="Services consultables pour devis et assistant." />
          <Feature title="Brouillon local" text="Devis ou demande gardé sur l’appareil." />
        </Panel>
      </div>

      <Notice type="warning" text="Message honnête : le MVP ne synchronise pas plusieurs appareils. Il sécurise seulement l’usage local sur un appareil." />
    </>
  )
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}

function Stat({ icon, label, value, hint, accent, warn }) {
  return (
    <article className={`stat ${accent ? 'accent' : ''} ${warn ? 'warn' : ''}`}>
      <div className="round-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  )
}

function Metric({ label, value, good, bad }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={good ? 'good' : bad ? 'bad' : ''}>{value}</strong>
    </div>
  )
}

function Feature({ title, text }) {
  return (
    <div className="feature">
      <div className="feature-icon">⌘</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function Notice({ text, type = 'info' }) {
  return <div className={`notice ${type}`}>{text}</div>
}

function Table({ rows, columns }) {
  if (!rows?.length) return <div className="empty">Aucune donnée disponible.</div>

  const cols = columns || Object.keys(rows[0]).slice(0, 4).map((key) => [key, key])

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map(([key, label]) => <th key={key}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {cols.map(([key]) => <td key={key}>{String(row[key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App



function normalizeOrderServices(order) {
  const raw = order?.services_snapshot ?? order?.services ?? order?.service_names ?? []

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          return item.name || item.title || item.label || item.service || ''
        }
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
            if (item && typeof item === 'object') {
              return item.name || item.title || item.label || item.service || ''
            }
            return ''
          })
          .filter(Boolean)
      }
    } catch (_) {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  if (raw && typeof raw === 'object') {
    return Object.values(raw)
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          return item.name || item.title || item.label || item.service || ''
        }
        return ''
      })
      .filter(Boolean)
  }

  return []
}

function orderServicesLabel(order) {
  const services = normalizeOrderServices(order)
  return services.length ? services.join(', ') : (order?.title || order?.problem_description || 'Intervention garage')
}

function DashboardModel({ api, setUser }) {
  const [data, setData] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function listFromResponse(response) {
    const payload = response?.data ?? response
    return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
  }

  function orderTitle(order) {
    return order?.title || order?.problem_description || order?.description || `Intervention #${order?.id || '—'}`
  }

  function orderClient(order) {
    return order?.customer?.name || order?.customer_name || (order?.customer_id ? `Client #${order.customer_id}` : 'Client')
  }

  function orderAmount(order) {
    return Number(order?.estimated_amount || order?.total_amount || 0)
  }

  function statusLabel(status) {
    const labels = {
      propose: 'Proposé',
      prevu: 'Prévu',
      en_cours: 'En cours',
      accepte: 'Accepté',
      termine: 'Terminé',
      annule: 'Annulé',
    }
    return labels[status] || status || 'Sans statut'
  }

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.all([api('/me'), api('/dashboard'), api('/work-orders')])
      .then(([meResponse, dashboardResponse, workOrdersResponse]) => {
        if (!active) return

        const mePayload = meResponse?.data ?? meResponse
        const dashboardPayload = dashboardResponse?.data ?? dashboardResponse

        if (setUser && mePayload?.user) {
          setUser(mePayload.user)
        }

        setData(dashboardPayload)
        setOrders(listFromResponse(workOrdersResponse))
        setError('')
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Impossible de charger le tableau de bord.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [api, setUser])

  if (loading && !data) return <Panel title="Chargement">Chargement du tableau de bord...</Panel>
  if (error && !data) return <Notice type="warning" text={error} />
  if (!data) return <Panel title="Tableau de bord">Aucune donnée disponible.</Panel>

  const charges = Number(data.expenses_total || 0)
  const recettes = Number(data.estimated_revenue || 0)
  const solde = Number(data.estimated_balance ?? (recettes - charges))
  const openCount = Number(data.work_orders_open_count || 0)
  const lowStockCount = Number(data.low_stock_count || 0)
  const todayCount = Number(data.today_appointments_count || 0)

  const balanceRate = recettes > 0 ? Math.round((solde / recettes) * 100) : 0
  const fragile = solde >= 0 && recettes > 0 && balanceRate < 15

  const healthLabel = solde < 0
    ? 'Risque économique'
    : fragile
      ? 'Équilibre fragile'
      : lowStockCount > 0
        ? 'Stock à surveiller'
        : 'Activité stable'

  const healthHint = solde < 0
    ? 'Les charges dépassent les recettes estimées'
    : fragile
      ? 'Marge positive mais faible'
      : lowStockCount > 0
        ? 'Des articles peuvent bloquer les interventions'
        : 'Aucune alerte critique'

  const alerts = []
  if (solde < 0) alerts.push({ niveau: 'Priorité', alerte: 'Solde économique négatif', action: 'Réduire les charges ou relancer les devis acceptés.' })
  if (fragile) alerts.push({ niveau: 'Attention', alerte: 'Marge économique faible', action: 'Contrôler les dépenses récentes.' })
  if (lowStockCount > 0) alerts.push({ niveau: 'Stock', alerte: `${lowStockCount} article(s) en stock faible`, action: 'Réapprovisionner les consommables critiques.' })
  if (openCount >= 5) alerts.push({ niveau: 'Opérations', alerte: `${openCount} devis/interventions ouverts`, action: 'Prioriser les dossiers acceptés et clôturer les terminés.' })
  if (!alerts.length) alerts.push({ niveau: 'OK', alerte: 'Aucune alerte bloquante', action: 'Continuer le suivi quotidien.' })

  const actions = [
    lowStockCount > 0 ? 'Vérifier les articles en stock faible.' : 'Maintenir le contrôle stock hebdomadaire.',
    openCount > 0 ? 'Relancer ou planifier les devis/interventions ouverts.' : 'Créer de nouveaux devis clients.',
    solde < 0 ? 'Identifier les charges les plus lourdes.' : 'Surveiller les charges pour préserver la marge.',
    todayCount > 0 ? 'Préparer les interventions du jour.' : 'Planifier les prochains rendez-vous.',
  ].map((action, index) => ({ priorite: index + 1, action }))

  const todayRows = orders
    .filter((order) => String(order?.scheduled_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10))
    .slice(0, 5)
    .map((order) => ({
      heure: String(order.scheduled_at || '').slice(11, 16) || '—',
      client: orderClient(order),
      intervention: orderTitle(order),
      statut: statusLabel(order.status),
    }))

  const quoteRows = orders.slice(0, 5).map((order) => ({
    client: orderClient(order),
    intervention: orderTitle(order),
    montant: money(orderAmount(order)),
    statut: statusLabel(order.status),
  }))

  return (
    <>
      {error && <Notice type="warning" text={error} />}

      <div className="stats-grid dashboard-model-stats">
        <Stat icon="♙" label="Clients" value={data.customers_count} hint="Clients suivis" />
        <Stat icon="▰" label="Véhicules" value={data.vehicles_count} hint="Historique lié aux clients" />
        <Stat icon="▤" label="Interventions ouvertes" value={openCount} hint="À planifier ou clôturer" accent />
        <Stat icon="⬡" label="Stock faible" value={lowStockCount} hint="Risque de blocage atelier" warn={lowStockCount > 0} />
        <Stat icon="ⓕ" label="Charges" value={money(charges)} hint="Dépenses enregistrées" warn />
        <Stat icon="●" label="Solde estimé" value={money(solde)} hint={healthHint} accent={solde >= 0} warn={solde < 0} />
        <Stat icon="◇" label="Santé activité" value={healthLabel} hint={`${balanceRate}% du chiffre estimé`} warn={solde < 0 || fragile || lowStockCount > 0} accent={solde >= 0 && !fragile && lowStockCount === 0} />
        <Stat icon="◷" label="Aujourd’hui" value={todayCount} hint="Rendez-vous / interventions" />
      </div>

      <div className="dashboard-model-panels">
        <Panel title="Viabilité économique patron">
          <Metric label="Recettes estimées" value={money(recettes)} good />
          <Metric label="Charges enregistrées" value={money(charges)} bad />
          <Metric label="Solde estimé" value={money(solde)} />
          <div className={solde >= 0 ? 'trend-pill good-bg' : 'trend-pill bad-bg'}>
            {solde < 0 ? 'Attention : charges supérieures aux recettes' : fragile ? 'Équilibre positif mais fragile' : '+ Activité positive'}
          </div>
        </Panel>

        <Panel title="Alertes patron">
          <Table rows={alerts} columns={[
            ['niveau', 'Niveau'],
            ['alerte', 'Alerte'],
            ['action', 'Action conseillée'],
          ]} />
        </Panel>
      </div>

      <Panel title="Actions recommandées aujourd’hui">
        <Table rows={actions} columns={[
          ['priorite', '#'],
          ['action', 'Action'],
        ]} />
      </Panel>

      <div className="dashboard-model-panels">
        <Panel title="Rendez-vous / interventions du jour">
          <Table rows={todayRows.length ? todayRows : [
            { heure: '—', client: 'Aucun rendez-vous', intervention: 'Planifier les prochaines interventions', statut: 'À organiser' },
          ]} columns={[
            ['heure', 'Heure'],
            ['client', 'Client'],
            ['intervention', 'Intervention'],
            ['statut', 'Statut'],
          ]} />
        </Panel>

        <Panel title="Derniers devis / interventions">
          <Table rows={quoteRows.length ? quoteRows : [
            { client: 'Aucun dossier', intervention: 'Créer un devis', montant: money(0), statut: 'À faire' },
          ]} columns={[
            ['client', 'Client'],
            ['intervention', 'Intervention'],
            ['montant', 'Montant'],
            ['statut', 'Statut'],
          ]} />
        </Panel>
      </div>
    </>
  )
}

