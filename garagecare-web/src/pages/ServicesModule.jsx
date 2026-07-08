import { useEffect, useMemo, useState } from 'react'
import './ServicesModule.css'

const emptyService = {
  name: '',
  category: '',
  description: '',
  estimated_price: '',
  estimated_duration: '',
  advice: '',
  is_active: true,
}

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`
}

export default function ServicesModule({ api }) {
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyService)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return services

    return services.filter((service) =>
      [
        service.name,
        service.category,
        service.description,
        service.advice,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    )
  }, [services, search])

  const stats = useMemo(() => {
    const active = services.filter((service) => service.is_active).length
    const packs = services.filter((service) => String(service.category || '').toLowerCase().includes('pack')).length
    const avg = services.length
      ? Math.round(services.reduce((sum, service) => sum + Number(service.estimated_price || 0), 0) / services.length)
      : 0

    return {
      total: services.length,
      active,
      packs,
      avg,
    }
  }, [services])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const response = await api('/services')
      setServices(response.data || [])
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
    setForm(emptyService)
    setShowForm(true)
    setMessage('')
    setError('')
  }

  function startEdit(service) {
    setEditingId(service.id)
    setForm({
      name: service.name || '',
      category: service.category || '',
      description: service.description || '',
      estimated_price: service.estimated_price || '',
      estimated_duration: service.estimated_duration || '',
      advice: service.advice || '',
      is_active: Boolean(service.is_active),
    })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  async function save(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    const payload = {
      ...form,
      estimated_price: Number(form.estimated_price || 0),
      estimated_duration: Number(form.estimated_duration || 0),
      is_active: Boolean(form.is_active),
    }

    try {
      if (editingId) {
        await api(`/services/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Offre modifiée avec succès.')
      } else {
        await api('/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Nouvelle offre ajoutée.')
      }

      setForm(emptyService)
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(service) {
    const ok = window.confirm(`Supprimer ou désactiver l’offre "${service.name}" ?`)
    if (!ok) return

    setMessage('')
    setError('')

    try {
      await api(`/services/${service.id}`, { method: 'DELETE' })
      setMessage('Offre supprimée.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleActive(service) {
    setMessage('')
    setError('')

    try {
      await api(`/services/${service.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: service.name,
          category: service.category,
          description: service.description,
          estimated_price: Number(service.estimated_price || 0),
          estimated_duration: Number(service.estimated_duration || 0),
          advice: service.advice || '',
          is_active: !service.is_active,
        }),
      })

      setMessage(service.is_active ? 'Offre désactivée.' : 'Offre activée.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="service-stats">
        <Stat label="Offres catalogue" value={stats.total} />
        <Stat label="Offres actives" value={stats.active} />
        <Stat label="Packs" value={stats.packs} />
        <Stat label="Prix moyen" value={money(stats.avg)} />
      </div>

      <section className="services-panel">
        <div className="services-toolbar">
          <div className="services-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une offre, une catégorie ou un conseil..."
            />
          </div>

          <button className="primary" onClick={startCreate}>+ Nouvelle offre</button>
        </div>
      </section>

      {(message || error) && (
        <div className={`service-notice ${error ? 'danger' : ''}`}>{error || message}</div>
      )}

      {showForm && (
        <section className="services-panel">
          <h2>{editingId ? 'Modifier l’offre' : 'Nouvelle offre garage'}</h2>

          <form className="service-form-grid" onSubmit={save}>
            <input placeholder="Nom de l’offre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input placeholder="Prix estimatif FCFA" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} />
            <input placeholder="Durée estimée minutes" value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} />
            <textarea placeholder="Description commerciale et opérationnelle" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <textarea placeholder="Conseil assistant / règle métier" value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} />

            <label className="active-check">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Offre active dans Devis et Assistant
            </label>

            <div className="service-form-actions">
              <button className="primary">Enregistrer l’offre</button>
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </form>
        </section>
      )}

      <section className="services-panel">
        <div className="services-list-header">
          <h2>Catalogue services</h2>
          <span>{filtered.length} offre{filtered.length > 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="service-empty">Chargement des offres...</div>
        ) : filtered.length === 0 ? (
          <div className="service-empty">Aucune offre trouvée.</div>
        ) : (
          <div className="services-catalog-grid">
            {filtered.map((service) => (
              <article className={`service-offer-card ${!service.is_active ? 'inactive' : ''}`} key={service.id}>
                <div className="service-card-top">
                  <div className="service-icon">⌘</div>
                  <span className={service.is_active ? 'service-status active' : 'service-status'}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3>{service.name}</h3>
                <p className="service-category">{service.category}</p>

                <div className="service-divider" />

                <div className="service-price-row">
                  <span>◷ {service.estimated_duration || 0} min</span>
                  <strong>{money(service.estimated_price)}</strong>
                </div>

                <p className="service-description">{service.description}</p>

                <div className="service-advice">
                  <strong>Conseil assistant</strong>
                  <p>{service.advice || 'Aucun conseil renseigné.'}</p>
                </div>

                <div className="service-actions">
                  <button className="mini-button" onClick={() => startEdit(service)}>Modifier</button>
                  <button className="mini-button" onClick={() => toggleActive(service)}>
                    {service.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button className="mini-button danger" onClick={() => remove(service)}>Supprimer</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="service-notice info">
        Mise à jour automatique : les offres actives alimentent les devis et l’assistant garage. Les offres désactivées ne doivent plus être proposées au client.
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <article className="service-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
