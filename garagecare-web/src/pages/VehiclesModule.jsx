import { useEffect, useMemo, useState } from 'react'
import './VehiclesModule.css'

const emptyVehicle = {
  customer_id: '',
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

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`
}

function dateFr(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR')
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

export default function VehiclesModule({ api }) {
  const [vehicles, setVehicles] = useState([])
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyVehicle)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return vehicles

    return vehicles.filter((vehicle) => {
      const owner = vehicle.customer?.name || ''
      return [
        vehicle.registration_number,
        vehicle.brand,
        vehicle.model,
        vehicle.color,
        vehicle.fuel_type,
        owner,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    })
  }, [vehicles, search])

  const stats = useMemo(() => {
    const withPhoto = vehicles.filter((vehicle) => vehicle.photo_data).length
    const highMileage = vehicles.filter((vehicle) => Number(vehicle.mileage || 0) >= 150000).length
    const fuelTypes = new Set(vehicles.map((vehicle) => vehicle.fuel_type).filter(Boolean))

    return {
      total: vehicles.length,
      withPhoto,
      highMileage,
      fuelTypes: fuelTypes.size,
    }
  }, [vehicles])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const [vehiclesResponse, customersResponse] = await Promise.all([
        api('/vehicles'),
        api('/customers'),
      ])

      setVehicles(vehiclesResponse.data || [])
      setCustomers(customersResponse.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [api])

  function startCreate() {
    setEditingId(null)
    setSelected(null)
    setForm({
      ...emptyVehicle,
      customer_id: customers[0]?.id || '',
    })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  function startEdit(vehicle) {
    setEditingId(vehicle.id)
    setForm({
      customer_id: vehicle.customer_id || vehicle.customer?.id || '',
      registration_number: vehicle.registration_number || '',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year || '',
      color: vehicle.color || '',
      mileage: vehicle.mileage || '',
      fuel_type: vehicle.fuel_type || '',
      notes: vehicle.notes || '',
      photo_data: vehicle.photo_data || '',
    })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      const payload = {
        ...form,
        customer_id: Number(form.customer_id),
        year: form.year ? Number(form.year) : null,
        mileage: form.mileage ? Number(form.mileage) : null,
      }

      if (editingId) {
        await api(`/vehicles/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Véhicule modifié avec succès.')
      } else {
        await api('/vehicles', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Véhicule ajouté avec succès.')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyVehicle)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(vehicle) {
    const ok = window.confirm(`Supprimer le véhicule ${vehicle.registration_number} ?`)
    if (!ok) return

    setMessage('')
    setError('')

    try {
      await api(`/vehicles/${vehicle.id}`, { method: 'DELETE' })
      setMessage('Véhicule supprimé.')
      setSelected(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function updatePhoto(vehicle, value) {
    setMessage('')
    setError('')

    try {
      await api(`/vehicles/${vehicle.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          customer_id: vehicle.customer_id || vehicle.customer?.id,
          registration_number: vehicle.registration_number,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color || '',
          mileage: vehicle.mileage,
          fuel_type: vehicle.fuel_type || '',
          notes: vehicle.notes || '',
          photo_data: value || '',
        }),
      })

      setMessage(value ? 'Photo véhicule enregistrée.' : 'Photo véhicule supprimée.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function choosePhoto(vehicle) {
    const dataUrl = await pickPhotoDataUrl()
    if (dataUrl) await updatePhoto(vehicle, dataUrl)
  }

  if (selected) {
    return (
      <>
        <section className="vehicle-detail-header">
          <button className="secondary-button" onClick={() => setSelected(null)}>← Retour parc</button>
          <div>
            <h2>Fiche véhicule</h2>
            <p>Historique, propriétaire, kilométrage, photos et interventions.</p>
          </div>
          <button className="secondary-button" onClick={() => startEdit(selected)}>Modifier</button>
          <button className="mini-button danger" onClick={() => remove(selected)}>Supprimer</button>
        </section>

        {(message || error) && (
          <div className={`vehicle-notice ${error ? 'danger' : ''}`}>{error || message}</div>
        )}

        <div className="vehicle-detail-grid">
          <section className="vehicle-panel">
            {selected.photo_data ? (
              <img className="vehicle-hero-photo" src={selected.photo_data} alt={selected.registration_number} />
            ) : (
              <div className="vehicle-hero-empty">Aucune photo véhicule</div>
            )}

            <div className="photo-actions">
              <button className="mini-button" onClick={() => choosePhoto(selected)}>
                {selected.photo_data ? 'Changer photo' : 'Ajouter photo'}
              </button>
              {selected.photo_data && (
                <button className="mini-button danger" onClick={() => updatePhoto(selected, '')}>
                  Supprimer photo
                </button>
              )}
            </div>
          </section>

          <section className="vehicle-panel">
            <h2>{selected.registration_number}</h2>
            <div className="vehicle-info-grid">
              <Info label="Propriétaire" value={selected.customer?.name || '—'} />
              <Info label="Téléphone" value={selected.customer?.phone || '—'} />
              <Info label="Marque" value={selected.brand} />
              <Info label="Modèle" value={selected.model} />
              <Info label="Année" value={selected.year || '—'} />
              <Info label="Couleur" value={selected.color || '—'} />
              <Info label="Kilométrage" value={selected.mileage ? `${selected.mileage} km` : '—'} />
              <Info label="Carburant" value={selected.fuel_type || '—'} />
            </div>

            <div className="vehicle-note">
              <strong>Notes véhicule</strong>
              <p>{selected.notes || 'Aucune note.'}</p>
            </div>
          </section>
        </div>

        <VehicleForm
          visible={showForm}
          title="Modifier le véhicule"
          form={form}
          customers={customers}
          onChange={setForm}
          onSubmit={save}
          onCancel={() => {
            setShowForm(false)
            setEditingId(null)
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className="vehicle-stats">
        <StatCard label="Véhicules suivis" value={stats.total} />
        <StatCard label="Avec photo" value={stats.withPhoto} />
        <StatCard label="Kilométrage élevé" value={stats.highMileage} />
        <StatCard label="Types carburant" value={stats.fuelTypes} />
      </div>

      <section className="vehicle-panel">
        <div className="vehicles-toolbar">
          <div className="vehicle-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par immatriculation, marque, modèle ou client..."
            />
          </div>

          <button className="primary" onClick={startCreate}>+ Nouveau véhicule</button>
        </div>
      </section>

      {(message || error) && (
        <div className={`vehicle-notice ${error ? 'danger' : ''}`}>{error || message}</div>
      )}

      <VehicleForm
        visible={showForm}
        title={editingId ? 'Modifier le véhicule' : 'Nouveau véhicule'}
        form={form}
        customers={customers}
        onChange={setForm}
        onSubmit={save}
        onCancel={() => {
          setShowForm(false)
          setEditingId(null)
        }}
      />

      <section className="vehicle-panel">
        <div className="vehicles-list-header">
          <h2>Parc véhicules</h2>
          <span>{filteredVehicles.length} véhicule{filteredVehicles.length > 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="vehicle-empty">Chargement des véhicules...</div>
        ) : filteredVehicles.length === 0 ? (
          <div className="vehicle-empty">Aucun véhicule trouvé.</div>
        ) : (
          <div className="vehicles-table-wrap">
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Immatriculation</th>
                  <th>Client</th>
                  <th>Marque</th>
                  <th>Modèle</th>
                  <th>Kilométrage</th>
                  <th>Carburant</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <div className="vehicle-photo-cell">
                        {vehicle.photo_data ? (
                          <img className="vehicle-mini-photo" src={vehicle.photo_data} alt={vehicle.registration_number} />
                        ) : (
                          <div className="vehicle-photo-empty">—</div>
                        )}
                        <button className="mini-button" onClick={() => choosePhoto(vehicle)}>
                          {vehicle.photo_data ? 'Changer' : 'Photo'}
                        </button>
                        {vehicle.photo_data && (
                          <button className="mini-button danger" onClick={() => updatePhoto(vehicle, '')}>
                            Suppr.
                          </button>
                        )}
                      </div>
                    </td>

                    <td>
                      <button className="vehicle-link" onClick={() => setSelected(vehicle)}>
                        {vehicle.registration_number}
                      </button>
                    </td>
                    <td>{vehicle.customer?.name || '—'}</td>
                    <td>{vehicle.brand}</td>
                    <td>{vehicle.model}</td>
                    <td>{vehicle.mileage ? `${vehicle.mileage} km` : '—'}</td>
                    <td>{vehicle.fuel_type || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="mini-button" onClick={() => setSelected(vehicle)}>Fiche</button>
                        <button className="mini-button" onClick={() => startEdit(vehicle)}>Modifier</button>
                        <button className="mini-button danger" onClick={() => remove(vehicle)}>Supprimer</button>
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

function VehicleForm({ visible, title, form, customers, onChange, onSubmit, onCancel }) {
  if (!visible) return null

  async function chooseFormPhoto() {
    const dataUrl = await pickPhotoDataUrl()
    if (dataUrl) onChange({ ...form, photo_data: dataUrl })
  }

  return (
    <section className="vehicle-panel">
      <h2>{title}</h2>
      <form onSubmit={onSubmit} className="vehicle-form-grid">
        <select value={form.customer_id} onChange={(e) => onChange({ ...form, customer_id: e.target.value })}>
          <option value="">Choisir le client propriétaire</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} — {customer.phone}
            </option>
          ))}
        </select>

        <input placeholder="Immatriculation" value={form.registration_number} onChange={(e) => onChange({ ...form, registration_number: e.target.value })} />
        <input placeholder="Marque" value={form.brand} onChange={(e) => onChange({ ...form, brand: e.target.value })} />
        <input placeholder="Modèle" value={form.model} onChange={(e) => onChange({ ...form, model: e.target.value })} />
        <input placeholder="Année" value={form.year} onChange={(e) => onChange({ ...form, year: e.target.value })} />
        <input placeholder="Couleur" value={form.color} onChange={(e) => onChange({ ...form, color: e.target.value })} />
        <input placeholder="Kilométrage" value={form.mileage} onChange={(e) => onChange({ ...form, mileage: e.target.value })} />
        <input placeholder="Carburant : essence, diesel..." value={form.fuel_type} onChange={(e) => onChange({ ...form, fuel_type: e.target.value })} />

        <textarea placeholder="Notes véhicule, état, défauts visibles..." value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} />

        <div className="vehicle-photo-editor">
          <div>
            <strong>Photo du véhicule</strong>
            <p>Ajouter, changer ou supprimer l’image principale du véhicule.</p>
          </div>

          {form.photo_data ? (
            <img className="vehicle-form-photo" src={form.photo_data} alt="Prévisualisation véhicule" />
          ) : (
            <div className="vehicle-form-photo empty">Aucune photo</div>
          )}

          <div className="photo-actions">
            <button type="button" className="secondary-button" onClick={chooseFormPhoto}>Choisir photo</button>
            {form.photo_data && (
              <button type="button" className="mini-button danger" onClick={() => onChange({ ...form, photo_data: '' })}>
                Supprimer photo
              </button>
            )}
          </div>
        </div>

        <div className="vehicle-form-actions">
          <button className="primary">Enregistrer le véhicule</button>
          <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
        </div>
      </form>
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <article className="vehicle-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Info({ label, value }) {
  return (
    <div className="vehicle-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
