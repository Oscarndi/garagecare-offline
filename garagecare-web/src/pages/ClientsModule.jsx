import { useEffect, useMemo, useState } from 'react'
import './ClientsModule.css'
import LoyaltyPanel from './LoyaltyPanel.jsx'

const emptyClient = { name: '', phone: '', address: '', notes: '', photo_data: '' }

const emptyVehicle = {
  registration_number: '',
  brand: '',
  model: '',
  year: '',
  color: '',
  mileage: '',
  fuel_type: '',
  notes: '',
  photo_data: '',
}

const emptyIntervention = {
  vehicle_id: '',
  scheduled_at: '',
  problem_description: '',
  services: [],
  before_photo_data: '',
  after_photo_data: '',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
}

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const img = new Image()

      img.onload = () => {
        const max = 1200
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.78))
      }

      img.onerror = reject
      img.src = reader.result
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}


export default function ClientsModule({ api }) {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [services, setServices] = useState([])
  const [clientForm, setClientForm] = useState(emptyClient)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [interventionForm, setInterventionForm] = useState(emptyIntervention)
  const [editingClientId, setEditingClientId] = useState(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [showInterventionForm, setShowInterventionForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const vehicles = useMemo(() => selected?.vehicles || [], [selected])
  const interventions = useMemo(() => selected?.work_orders || selected?.workOrders || [], [selected])

  async function loadClients(query = search) {
    setLoading(true)
    setError('')

    try {
      const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''
      const response = await api(`/customers${suffix}`)
      setClients(response.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadServices() {
    try {
      const response = await api('/services?active_only=1')
      setServices(response.data || [])
    } catch {
      setServices([])
    }
  }

  async function openClient(customer) {
    setError('')
    setMessage('')

    try {
      const response = await api(`/customers/${customer.id}`)
      const detail = response.data
      setSelected(detail)

      const firstVehicleId = detail.vehicles?.[0]?.id || ''
      const firstServiceId = services[0]?.id || ''

      setInterventionForm({
        ...emptyIntervention,
        vehicle_id: firstVehicleId,
        services: firstServiceId ? [firstServiceId] : [],
      })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadServices()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadClients(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  function startCreateClient() {
    setSelected(null)
    setEditingClientId(null)
    setClientForm(emptyClient)
    setShowClientForm(true)
    setMessage('')
    setError('')
  }

  function startEditClient(customer) {
    setEditingClientId(customer.id)
    setClientForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      photo_data: customer.photo_data || '',
    })
    setShowClientForm(true)
    setMessage('')
    setError('')
  }

  async function saveClient(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      if (editingClientId) {
        await api(`/customers/${editingClientId}`, {
          method: 'PUT',
          body: JSON.stringify(clientForm),
        })
        setMessage('Client modifié avec succès.')
      } else {
        await api('/customers', {
          method: 'POST',
          body: JSON.stringify(clientForm),
        })
        setMessage('Client enregistré avec succès.')
      }

      setClientForm(emptyClient)
      setEditingClientId(null)
      setShowClientForm(false)
      await loadClients()

      if (selected) {
        await openClient(selected)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteClient(customer) {
    if (!window.confirm(`Supprimer le client ${customer.name} ?`)) return

    setMessage('')
    setError('')

    try {
      await api(`/customers/${customer.id}`, { method: 'DELETE' })
      setMessage('Client supprimé.')
      setSelected(null)
      await loadClients()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveVehicle(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!selected?.id) {
      setError('Sélectionnez d’abord un client.')
      return
    }

    try {
      await api('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          ...vehicleForm,
          customer_id: selected.id,
          year: vehicleForm.year ? Number(vehicleForm.year) : null,
          mileage: vehicleForm.mileage ? Number(vehicleForm.mileage) : null,
        }),
      })

      setVehicleForm(emptyVehicle)
      setShowVehicleForm(false)
      setMessage('Véhicule ajouté au client.')
      await openClient(selected)
      await loadClients()
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleService(serviceId) {
    setInterventionForm((current) => ({
      ...current,
      services: current.services.includes(serviceId)
        ? current.services.filter((id) => id !== serviceId)
        : [...current.services, serviceId],
    }))
  }

  async function saveIntervention(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!selected?.id) {
      setError('Sélectionnez d’abord un client.')
      return
    }

    if (!interventionForm.vehicle_id) {
      setError('Ajoutez ou sélectionnez un véhicule.')
      return
    }

    if (!interventionForm.services.length) {
      setError('Sélectionnez au moins un service.')
      return
    }

    try {
      const scheduledAt = interventionForm.scheduled_at
        ? interventionForm.scheduled_at.replace('T', ' ') + ':00'
        : null

      await api('/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selected.id,
          vehicle_id: Number(interventionForm.vehicle_id),
          scheduled_at: scheduledAt,
          problem_description: interventionForm.problem_description,
          services: interventionForm.services,
          status: 'propose',
          before_photo_data: interventionForm.before_photo_data || null,
          after_photo_data: interventionForm.after_photo_data || null,
        }),
      })

      setInterventionForm({
        ...emptyIntervention,
        vehicle_id: vehicles[0]?.id || '',
        services: services[0]?.id ? [services[0].id] : [],
        before_photo_data: '',
        after_photo_data: '',
      })
      setShowInterventionForm(false)
      setMessage('Panne / maintenance enregistrée.')
      await openClient(selected)
    } catch (err) {
      setError(err.message)
    }
  }

  if (selected) {
    return (
      <ClientDetail
        client={selected}
        api={api}
        refreshSelected={() => openClient(selected)}
        vehicles={vehicles}
        interventions={interventions}
        services={services}
        clientForm={clientForm}
        vehicleForm={vehicleForm}
        interventionForm={interventionForm}
        showClientForm={showClientForm}
        showVehicleForm={showVehicleForm}
        showInterventionForm={showInterventionForm}
        message={message}
        error={error}
        onBack={() => {
          setSelected(null)
          setShowClientForm(false)
          setShowVehicleForm(false)
          setShowInterventionForm(false)
        }}
        onEditClient={() => startEditClient(selected)}
        onDeleteClient={() => deleteClient(selected)}
        onSaveClient={saveClient}
        onClientFormChange={setClientForm}
        onVehicleFormChange={setVehicleForm}
        onInterventionFormChange={setInterventionForm}
        onToggleService={toggleService}
        onSaveVehicle={saveVehicle}
        onSaveIntervention={saveIntervention}
        onShowVehicleForm={() => setShowVehicleForm(true)}
        onShowInterventionForm={() => setShowInterventionForm(true)}
        onCancelForms={() => {
          setShowClientForm(false)
          setShowVehicleForm(false)
          setShowInterventionForm(false)
          setEditingClientId(null)
        }}
      />
    )
  }

  return (
    <>
      <section className="gc-client-panel">
        <div className="clients-toolbar">
          <div className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un client par nom ou téléphone..."
            />
          </div>

          <button className="primary new-client-button" onClick={startCreateClient}>
            + Nouveau client
          </button>
        </div>
      </section>

      {(message || error) && (
        <div className={`client-notice ${error ? 'danger' : ''}`}>
          {error || message}
        </div>
      )}


      {showClientForm && (
        <ClientForm
          title={editingClientId ? 'Modifier le client' : 'Nouveau client'}
          form={clientForm}
          onChange={setClientForm}
          onSubmit={saveClient}
          onCancel={() => {
            setShowClientForm(false)
            setEditingClientId(null)
          }}
        />
      )}

      <section className="gc-client-panel">
        <div className="clients-list-header">
          <h2>Liste des clients</h2>
          <span>{clients.length} client{clients.length > 1 ? 's' : ''}</span>
          <button className="secondary-button" onClick={startCreateClient}>+ Ajouter</button>
        </div>

        {loading ? (
          <div className="empty-state">Chargement des clients...</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">Aucun client trouvé. Ajoutez un client ou modifiez la recherche.</div>
        ) : (
          <ClientsTable
            clients={clients}
            onOpen={openClient}
            onEdit={startEditClient}
            onDelete={deleteClient}
          />
        )}
      </section>

      <div className="client-notice info">
        UX : vue générale pour tous les clients, puis fiche détaillée client par client avec véhicules, pannes et maintenances.
      </div>
    </>
  )
}

function ClientsTable({ clients, onOpen, onEdit, onDelete }) {
  return (
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
          {clients.map((client) => (
            <tr key={client.id}>
              <td>
                <button className="client-link" onClick={() => onOpen(client)}>
                  <span className="client-avatar">{(client.name || '?').slice(0, 1).toUpperCase()}</span>
                  <strong>{client.name}</strong>
                </button>
              </td>
              <td>☎ {client.phone}</td>
              <td>▰ {client.vehicles_count ?? 0}</td>
              <td>{client.address || '—'}</td>
              <td>
                <div className="row-actions">
                  <button className="mini-button" onClick={() => onOpen(client)}>Fiche</button>
                  <button className="mini-button" onClick={() => onEdit(client)}>Modifier</button>
                  <button className="mini-button danger" onClick={() => onDelete(client)}>Supprimer</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ClientDetail(props) {
  const {
    client,
    api,
    refreshSelected,
    vehicles,
    interventions,
    services,
    clientForm,
    vehicleForm,
    interventionForm,
    showClientForm,
    showVehicleForm,
    showInterventionForm,
    message,
    error,
    onBack,
    onEditClient,
    onDeleteClient,
    onSaveClient,
    onClientFormChange,
    onVehicleFormChange,
    onInterventionFormChange,
    onToggleService,
    onSaveVehicle,
    onSaveIntervention,
    onShowVehicleForm,
    onShowInterventionForm,
    onCancelForms,
  } = props

  const lastIntervention = interventions[0]
  const totalEstimated = interventions.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0)

  async function updateClientPhoto(value) {
    await api(`/customers/${client.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: client.name,
        phone: client.phone,
        address: client.address || '',
        notes: client.notes || '',
        photo_data: value || '',
      }),
    })

    await refreshSelected?.()
  }

  async function chooseClientPhoto() {
    const dataUrl = await pickPhotoDataUrl()
    if (dataUrl) await updateClientPhoto(dataUrl)
  }

  async function updateVehiclePhoto(vehicle, value) {
    await api(`/vehicles/${vehicle.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        photo_data: value || '',
      }),
    })

    await refreshSelected?.()
  }

  async function chooseVehiclePhoto(vehicle) {
    const dataUrl = await pickPhotoDataUrl()
    if (dataUrl) await updateVehiclePhoto(vehicle, dataUrl)
  }

  async function updateInterventionPhoto(item, field, value) {
    await api(`/work-orders/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        [field]: value || '',
      }),
    })

    await refreshSelected?.()
  }

  async function chooseInterventionPhoto(item, field) {
    const dataUrl = await pickPhotoDataUrl()
    if (dataUrl) await updateInterventionPhoto(item, field, dataUrl)
  }

  async function quickEditVehicle(vehicle) {
    const registration_number = window.prompt('Immatriculation', vehicle.registration_number || '')
    if (registration_number === null) return

    const brand = window.prompt('Marque', vehicle.brand || '')
    if (brand === null) return

    const model = window.prompt('Modèle', vehicle.model || '')
    if (model === null) return

    const year = window.prompt('Année', vehicle.year || '')
    if (year === null) return

    const color = window.prompt('Couleur', vehicle.color || '')
    if (color === null) return

    const mileage = window.prompt('Kilométrage', vehicle.mileage || '')
    if (mileage === null) return

    const fuel_type = window.prompt('Carburant', vehicle.fuel_type || '')
    if (fuel_type === null) return

    const notes = window.prompt('Notes véhicule', vehicle.notes || '')
    if (notes === null) return

    await api(`/vehicles/${vehicle.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        registration_number,
        brand,
        model,
        year: year ? Number(year) : null,
        color,
        mileage: mileage ? Number(mileage) : null,
        fuel_type,
        notes,
        photo_data: vehicle.photo_data || '',
      }),
    })

    await refreshSelected?.()
  }

  async function deleteVehicle(vehicle) {
    const ok = window.confirm(`Supprimer le véhicule ${vehicle.registration_number} ? Cela peut aussi supprimer ses interventions liées.`)
    if (!ok) return

    await api(`/vehicles/${vehicle.id}`, { method: 'DELETE' })
    await refreshSelected?.()
  }

  async function quickEditIntervention(item) {
    const currentDate = item.scheduled_at ? String(item.scheduled_at).slice(0, 16).replace('T', ' ') : ''
    const scheduled_at = window.prompt('Date maintenance / intervention (AAAA-MM-JJ HH:MM)', currentDate)
    if (scheduled_at === null) return

    const problem_description = window.prompt('Panne / demande', item.problem_description || '')
    if (problem_description === null) return

    const status = window.prompt('Statut : brouillon, propose, accepte, prevu, en_cours, termine, annule', item.status || 'propose')
    if (status === null) return

    const currentIds = (item.services_snapshot || []).map((service) => service.id).filter(Boolean).join(',')
    const serviceHelp = services.map((service) => `${service.id}:${service.name}`).join(' | ')
    const servicesText = window.prompt(`Services par ID, séparés par virgule. Catalogue : ${serviceHelp}`, currentIds || String(services[0]?.id || ''))
    if (servicesText === null) return

    const serviceIds = servicesText
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Boolean)

    await api(`/work-orders/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        vehicle_id: item.vehicle_id || item.vehicle?.id || vehicles[0]?.id,
        scheduled_at,
        problem_description,
        status,
        services: serviceIds,
      }),
    })

    await refreshSelected?.()
  }

  async function deleteIntervention(item) {
    const ok = window.confirm('Supprimer cette panne / maintenance / intervention ?')
    if (!ok) return

    await api(`/work-orders/${item.id}`, { method: 'DELETE' })
    await refreshSelected?.()
  }

  return (
    <>
      <section className="client-detail-header">
        <button className="secondary-button" onClick={onBack}>← Retour liste</button>
        <div>
          <h2>Fiche client</h2>
          <p>Client, véhicules associés, pannes, maintenances et historique.</p>
        </div>
        <button className="secondary-button" onClick={onEditClient}>Modifier client</button>
        <button className="mini-button danger" onClick={onDeleteClient}>Supprimer</button>
      </section>

      {(message || error) && (
        <div className={`client-notice ${error ? 'danger' : ''}`}>
          {error || message}
        </div>
      )}

      <div className="client-detail-grid">
        <section className="gc-client-panel">
          <div className="client-profile">
            {client.photo_data ? (
              <img className="client-big-photo" src={client.photo_data} alt={client.name} />
            ) : (
              <div className="client-big-avatar">{(client.name || '?').slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <h2>{client.name}</h2>
              <p>☎ {client.phone}</p>
              <p>⌖ {client.address || 'Adresse non renseignée'}</p>
            </div>
          </div>

          <div className="photo-line-actions">
            <button className="mini-button" onClick={chooseClientPhoto}>Changer photo client</button>
            {client.photo_data && (
              <button className="mini-button danger" onClick={() => updateClientPhoto('')}>Supprimer photo client</button>
            )}
          </div>

          <div className="client-note">
            <strong>Note</strong>
            <p>{client.notes || 'Aucune note enregistrée.'}</p>
          </div>
        </section>

        <section className="gc-client-panel">
          <h2>Résumé client</h2>
          <div className="client-summary-grid">
            <Summary label="Véhicules" value={vehicles.length} />
            <Summary label="Pannes / maintenances" value={interventions.length} />
            <Summary label="Dernière maintenance" value={formatDate(lastIntervention?.scheduled_at)} />
            <Summary label="Montant estimé" value={money(totalEstimated)} />
          </div>
        </section>
      </div>

      <LoyaltyPanel api={api} client={client} />

      {showClientForm && (
        <ClientForm
          title="Modifier le client"
          form={clientForm}
          onChange={onClientFormChange}
          onSubmit={onSaveClient}
          onCancel={onCancelForms}
        />
      )}

      <section className="gc-client-panel">
        <div className="clients-list-header">
          <h2>Véhicules du client</h2>
          <span>{vehicles.length}</span>
          <button className="secondary-button" onClick={onShowVehicleForm}>+ Ajouter véhicule</button>
        </div>

        {showVehicleForm && (
          <VehicleForm
            form={vehicleForm}
            onChange={onVehicleFormChange}
            onSubmit={onSaveVehicle}
            onCancel={onCancelForms}
          />
        )}

        {vehicles.length === 0 ? (
          <div className="empty-state">Aucun véhicule. Ajoutez une immatriculation, marque, modèle et kilométrage.</div>
        ) : (
          <div className="clients-table-wrap">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Immatriculation</th>
                  <th>Marque</th>
                  <th>Modèle</th>
                  <th>Année</th>
                  <th>Kilométrage</th>
                  <th>Carburant</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <div className="photo-cell">
                        {vehicle.photo_data ? <img className="mini-photo" src={vehicle.photo_data} alt="Véhicule" /> : <span>—</span>}
                        <button className="mini-button" onClick={() => chooseVehiclePhoto(vehicle)}>
                          {vehicle.photo_data ? 'Changer' : 'Ajouter photo'}
                        </button>
                        {vehicle.photo_data && (
                          <button className="mini-button danger" onClick={() => updateVehiclePhoto(vehicle, '')}>Supprimer</button>
                        )}
                      </div>
                    </td>
                    <td>{vehicle.registration_number}</td>
                    <td>{vehicle.brand}</td>
                    <td>{vehicle.model}</td>
                    <td>{vehicle.year || '—'}</td>
                    <td>{vehicle.mileage ? `${vehicle.mileage} km` : '—'}</td>
                    <td>{vehicle.fuel_type || '—'}</td>
                    <td>{vehicle.notes || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-button" onClick={() => quickEditVehicle(vehicle)}>Modifier</button>
                        <button className="mini-button danger" onClick={() => deleteVehicle(vehicle)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="gc-client-panel">
        <div className="clients-list-header">
          <h2>Pannes, maintenances et devis</h2>
          <span>{interventions.length}</span>
          <button className="secondary-button" onClick={onShowInterventionForm}>+ Maintenance / panne</button>
        </div>

        {showInterventionForm && (
          <InterventionForm
            vehicles={vehicles}
            services={services}
            form={interventionForm}
            onChange={onInterventionFormChange}
            onToggleService={onToggleService}
            onSubmit={onSaveIntervention}
            onCancel={onCancelForms}
          />
        )}

        {interventions.length === 0 ? (
          <div className="empty-state">Aucune panne ou maintenance enregistrée pour ce client.</div>
        ) : (
          <div className="clients-table-wrap">
            <table className="clients-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Avant</th>
                  <th>Après</th>
                  <th>Véhicule</th>
                  <th>Panne / demande</th>
                  <th>Services</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {interventions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.scheduled_at)}</td>
                    <td>
                      <div className="photo-cell">
                        {item.before_photo_data ? <img className="mini-photo" src={item.before_photo_data} alt="Avant" /> : <span>—</span>}
                        <button className="mini-button" onClick={() => chooseInterventionPhoto(item, 'before_photo_data')}>
                          {item.before_photo_data ? 'Changer' : 'Ajouter'}
                        </button>
                        {item.before_photo_data && (
                          <button className="mini-button danger" onClick={() => updateInterventionPhoto(item, 'before_photo_data', '')}>Supprimer</button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="photo-cell">
                        {item.after_photo_data ? <img className="mini-photo" src={item.after_photo_data} alt="Après" /> : <span>—</span>}
                        <button className="mini-button" onClick={() => chooseInterventionPhoto(item, 'after_photo_data')}>
                          {item.after_photo_data ? 'Changer' : 'Ajouter'}
                        </button>
                        {item.after_photo_data && (
                          <button className="mini-button danger" onClick={() => updateInterventionPhoto(item, 'after_photo_data', '')}>Supprimer</button>
                        )}
                      </div>
                    </td>
                    <td>{item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : '—'}</td>
                    <td>{item.problem_description}</td>
                    <td>{(item.services_snapshot || []).map((service) => service.name).join(', ') || '—'}</td>
                    <td>{item.status}</td>
                    <td>{money(item.estimated_amount)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-button" onClick={() => quickEditIntervention(item)}>Modifier</button>
                        <button className="mini-button danger" onClick={() => deleteIntervention(item)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Summary({ label, value }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ClientForm({ title, form, onChange, onSubmit, onCancel }) {
  return (
    <section className="gc-client-panel">
      <h2>{title}</h2>
      <form onSubmit={onSubmit} className="client-form-grid">
        <input placeholder="Nom complet" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
        <input placeholder="Téléphone" value={form.phone} onChange={(e) => onChange({ ...form, phone: e.target.value })} />
        <input placeholder="Adresse / quartier" value={form.address} onChange={(e) => onChange({ ...form, address: e.target.value })} />
        <textarea placeholder="Notes : préférences, habitudes, remarques..." value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />

        <PhotoEditor
          label="Photo du client"
          value={form.photo_data}
          onChange={(value) => onChange({ ...form, photo_data: value })}
        />

        <div className="client-form-actions">
          <button className="primary">Enregistrer le client</button>
          <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
        </div>
      </form>
    </section>
  )
}

function VehicleForm({ form, onChange, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="client-form-grid nested-form">
      <input placeholder="Immatriculation" value={form.registration_number} onChange={(e) => onChange({ ...form, registration_number: e.target.value })} />
      <input placeholder="Marque : Toyota, Renault..." value={form.brand} onChange={(e) => onChange({ ...form, brand: e.target.value })} />
      <input placeholder="Modèle : Corolla, Yaris..." value={form.model} onChange={(e) => onChange({ ...form, model: e.target.value })} />
      <input placeholder="Année" value={form.year} onChange={(e) => onChange({ ...form, year: e.target.value })} />
      <input placeholder="Couleur" value={form.color} onChange={(e) => onChange({ ...form, color: e.target.value })} />
      <input placeholder="Kilométrage" value={form.mileage} onChange={(e) => onChange({ ...form, mileage: e.target.value })} />
      <input placeholder="Carburant : essence, diesel..." value={form.fuel_type} onChange={(e) => onChange({ ...form, fuel_type: e.target.value })} />
      <textarea placeholder="Notes véhicule : état, remarques, habitudes..." value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />

      <PhotoEditor
        label="Photo du véhicule"
        value={form.photo_data}
        onChange={(value) => onChange({ ...form, photo_data: value })}
      />

      <div className="client-form-actions">
        <button className="primary">Enregistrer le véhicule</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

function InterventionForm({ vehicles, services, form, onChange, onToggleService, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="client-form-grid nested-form">
      <select value={form.vehicle_id} onChange={(e) => onChange({ ...form, vehicle_id: e.target.value })}>
        <option value="">Choisir le véhicule</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.registration_number} — {vehicle.brand} {vehicle.model}
          </option>
        ))}
      </select>

      <input
        type="datetime-local"
        value={form.scheduled_at}
        onChange={(e) => onChange({ ...form, scheduled_at: e.target.value })}
      />

      <textarea
        placeholder="Panne / besoin client : bruit au freinage, vidange, voyant moteur..."
        value={form.problem_description}
        onChange={(e) => onChange({ ...form, problem_description: e.target.value })}
      />

      <PhotoEditor
        label="Photo avant maintenance"
        value={form.before_photo_data}
        onChange={(value) => onChange({ ...form, before_photo_data: value })}
      />

      <PhotoEditor
        label="Photo après maintenance"
        value={form.after_photo_data}
        onChange={(value) => onChange({ ...form, after_photo_data: value })}
      />

      <div className="services-checklist">
        <strong>Services concernés</strong>
        {services.map((service) => (
          <label key={service.id}>
            <input
              type="checkbox"
              checked={form.services.includes(service.id)}
              onChange={() => onToggleService(service.id)}
            />
            {service.name} — {money(service.estimated_price)}
          </label>
        ))}
      </div>

      <div className="client-form-actions">
        <button className="primary">Enregistrer maintenance / panne</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}


function PhotoEditor({ label, value, onChange }) {
  async function selectPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await imageFileToDataUrl(file)
    onChange(dataUrl)
    event.target.value = ''
  }

  return (
    <div className="photo-editor">
      <div>
        <strong>{label}</strong>
        <p>Ajouter, remplacer ou supprimer la photo.</p>
      </div>

      {value ? (
        <img className="photo-preview" src={value} alt={label} />
      ) : (
        <div className="photo-empty">Aucune photo</div>
      )}

      <div className="photo-actions">
        <label className="secondary-button photo-upload">
          Choisir une photo
          <input type="file" accept="image/*" onChange={selectPhoto} />
        </label>

        {value && (
          <button type="button" className="mini-button danger" onClick={() => onChange('')}>
            Supprimer photo
          </button>
        )}
      </div>
    </div>
  )
}


function pickPhotoDataUrl() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve('')
        return
      }

      const dataUrl = await imageFileToDataUrl(file)
      resolve(dataUrl)
    }

    input.click()
  })
}
