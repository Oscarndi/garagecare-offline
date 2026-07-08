import { useEffect, useMemo, useState } from 'react'
import './LoyaltyPanel.css'

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} FCFA`
}

function orderDebt(order) {
  return Number(order?.debt_amount ?? Math.max(0, Number(order?.total_amount || order?.estimated_amount || 0) - Number(order?.paid_amount || 0)))
}

function orderLabel(order) {
  if (!order) return ''
  const title = order.display_title || order.title || `Dossier #${order.id}`
  return `${title} · total ${money(order.total_amount || order.estimated_amount)} · reste ${money(orderDebt(order))}`
}

export default function LoyaltyPanel({ api, client }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rewardRuleId, setRewardRuleId] = useState('')
  const [rewardWorkOrderId, setRewardWorkOrderId] = useState('')
  const [debtWorkOrderId, setDebtWorkOrderId] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [reminderText, setReminderText] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [earnForm, setEarnForm] = useState({ service_amount: '', parts_amount: '', bonus_points: '', reason: '' })
  const [adjustForm, setAdjustForm] = useState({ points: '', reason: '' })

  const account = data?.account
  const billing = data?.billing || {}
  const transactions = data?.transactions || []
  const rewards = data?.reward_rules || []
  const workOrders = data?.work_orders || []
  const outstandingOrders = workOrders.filter((order) => orderDebt(order) > 0)
  const rewardTargets = workOrders.filter((order) => Number(order.discount_amount || 0) <= 0)

  const selectedReward = useMemo(() => {
    return rewards.find((rule) => String(rule.id) === String(rewardRuleId))
  }, [rewards, rewardRuleId])

  const selectedRewardTarget = useMemo(() => {
    return workOrders.find((order) => String(order.id) === String(rewardWorkOrderId))
  }, [workOrders, rewardWorkOrderId])

  const discountedWorkOrders = useMemo(() => {
    return workOrders.filter((order) => Number(order.discount_amount || 0) > 0)
  }, [workOrders])

  async function load() {
    if (!client?.id) return

    setLoading(true)
    setError('')

    try {
      const response = await api(`/customers/${client.id}/loyalty`)
      setData(response.data)

      const firstReward = response.data?.reward_rules?.[0]
      const firstTarget = response.data?.work_orders?.find((order) => Number(order.discount_amount || 0) <= 0)
      const firstDebt = response.data?.work_orders?.find((order) => Number(order.debt_amount || 0) > 0)

      if (firstReward && !rewardRuleId) setRewardRuleId(firstReward.id)
      if (firstTarget && !rewardWorkOrderId) setRewardWorkOrderId(firstTarget.id)
      if (firstDebt && !debtWorkOrderId) setDebtWorkOrderId(firstDebt.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [client?.id])

  async function addPoints(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      const response = await api(`/customers/${client.id}/loyalty/earn`, {
        method: 'POST',
        body: JSON.stringify({
          service_amount: Number(earnForm.service_amount || 0),
          parts_amount: Number(earnForm.parts_amount || 0),
          bonus_points: Number(earnForm.bonus_points || 0),
          reason: earnForm.reason || 'Points ajoutés manuellement',
        }),
      })

      setMessage(response.message || 'Points ajoutés.')
      setEarnForm({ service_amount: '', parts_amount: '', bonus_points: '', reason: '' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function applyReward(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (!rewardRuleId || !rewardWorkOrderId) {
      setError('Choisis une récompense et une facture.')
      return
    }

    const rewardLabel = selectedReward?.name || 'Récompense fidélité'
    const targetLabel = selectedRewardTarget
      ? `facture #${selectedRewardTarget.id}`
      : 'facture sélectionnée'
    const ok = window.confirm(
      `Confirmer l'application de "${rewardLabel}" sur la ${targetLabel} ? Cette action débite les points et applique une remise.`
    )
    if (!ok) return

    try {
      const response = await api(`/customers/${client.id}/loyalty/apply-reward`, {
        method: 'POST',
        body: JSON.stringify({
          reward_rule_id: Number(rewardRuleId),
          work_order_id: Number(rewardWorkOrderId),
          reason: selectedReward?.name || 'Récompense fidélité appliquée',
        }),
      })

      setMessage(response.message || 'Récompense appliquée.')
      setData(response.data)
      setReminderText('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function payDebt(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (Number(debtAmount || 0) <= 0) {
      setError('Indique le montant encaissé.')
      return
    }

    try {
      const payload = {
        amount: Number(debtAmount || 0),
        reason: 'Règlement dette client',
      }

      if (debtWorkOrderId) {
        payload.work_order_id = Number(debtWorkOrderId)
      }

      const response = await api(`/customers/${client.id}/loyalty/pay-debt`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setMessage(response.message || 'Paiement enregistré.')
      setData(response.data)
      setDebtAmount('')
      setReminderText('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function generateReminder() {
    setMessage('')
    setError('')

    try {
      const response = await api(`/customers/${client.id}/loyalty/debt-reminder`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Rappel de dette généré depuis la fiche client' }),
      })

      setMessage(response.message || 'Rappel généré.')
      setData(response.data)
      setReminderText(response.data?.debt_reminder || '')
    } catch (err) {
      setError(err.message)
    }
  }

  async function adjustPoints(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      const response = await api(`/customers/${client.id}/loyalty/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          points: Number(adjustForm.points || 0),
          reason: adjustForm.reason || 'Ajustement manuel',
        }),
      })

      setMessage(response.message || 'Ajustement enregistré.')
      setAdjustForm({ points: '', reason: '' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!client?.id) return null


  async function copyReminderText() {
    setError('')
    setCopyStatus('')

    if (!reminderText) {
      setError('Génère d’abord un rappel avant de le copier.')
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reminderText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = reminderText
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopyStatus('Rappel copié. Tu peux le coller dans WhatsApp, SMS ou un message client.')
      setMessage('Rappel copié.')
    } catch (err) {
      setError(err.message || 'Impossible de copier automatiquement le rappel.')
    }
  }

  return (
    <section className="loyalty-panel">
      <div className="loyalty-header">
        <div>
          <h2>Relation client</h2>
          <p>Points fidélité, facturation, dette, récompenses et historique.</p>
        </div>

        <button className="secondary-button" onClick={load}>
          Actualiser
        </button>
      </div>

      {loading && <div className="loyalty-notice">Chargement fidélité...</div>}
      {message && <div className="loyalty-notice">{message}</div>}
      {error && <div className="loyalty-notice danger">{error}</div>}

      {account && (
        <>
          <div className="loyalty-stats">
            <LoyaltyStat label="Points disponibles" value={account.points_balance} highlight />
            <LoyaltyStat label="Points cumulés" value={account.lifetime_points} />
            <LoyaltyStat label="Points utilisés" value={account.points_redeemed} />
            <LoyaltyStat label="Niveau" value={account.tier} tier={account.tier} />
            <LoyaltyStat label="Score relation" value={`${account.relation_score}/100`} />
            <LoyaltyStat label="Total facturé" value={money(billing.total_billed)} />
            <LoyaltyStat label="Total encaissé" value={money(account.total_paid)} />
            <LoyaltyStat label="Reste dû / dette" value={money(account.debt_current)} danger={Number(account.debt_current) > 0} />
            <LoyaltyStat label="Factures soldées" value={billing.fully_paid_count || 0} />
            <LoyaltyStat label="Paiements partiels" value={billing.partial_paid_count || 0} />
            <LoyaltyStat label="Réductions reçues" value={money(account.total_discount_received)} />
          </div>

          {Number(account.debt_current || 0) > 0 && (
            <div className="loyalty-warning">
              Dette ouverte : les récompenses sont bloquées si cette dette concerne d’autres factures. Encaisse la dette ou génère un rappel.
            </div>
          )}

          <div className="loyalty-actions-grid">
            <form className="loyalty-card" onSubmit={applyReward}>
              <h3>Appliquer récompense à une facture</h3>
              <p>La remise est liée au devis/intervention sélectionné. Les points ne sont plus consommés dans le vide.</p>

              <select value={rewardRuleId} onChange={(e) => setRewardRuleId(e.target.value)}>
                <option value="">Choisir une récompense</option>
                {rewards.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.required_points} pts — {reward.name}
                  </option>
                ))}
              </select>

              <select value={rewardWorkOrderId} onChange={(e) => setRewardWorkOrderId(e.target.value)}>
                <option value="">Choisir une facture/devis</option>
                {rewardTargets.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.id} — {orderLabel(order)}
                  </option>
                ))}
              </select>

              {selectedRewardTarget && (
                <div className="reward-preview">
                  <strong>Facture sélectionnée #{selectedRewardTarget.id}</strong>
                  <span>Total actuel : {money(selectedRewardTarget.total_amount)}</span>
                  <span>Déjà payé : {money(selectedRewardTarget.paid_amount)}</span>
                  <span>Reste dû : {money(Number(selectedRewardTarget.total_amount || 0) - Number(selectedRewardTarget.paid_amount || 0))}</span>
                </div>
              )}

              {discountedWorkOrders.length > 0 && (
                <div className="reward-preview">
                  <strong>Remises déjà appliquées</strong>
                  <span>{discountedWorkOrders.length} facture(s) déjà remisée(s) sont masquées de la liste pour éviter une double réduction.</span>
                </div>
              )}

              {selectedReward && (
                <div className="reward-preview">
                  <strong>{selectedReward.name}</strong>
                  <span>Coût : {selectedReward.required_points} points</span>
                  <span>Type : {selectedReward.discount_type}</span>
                  <span>Valeur : {selectedReward.discount_value}</span>
                  <span>Plafond : {selectedReward.max_discount_amount ? money(selectedReward.max_discount_amount) : '—'}</span>
                </div>
              )}

              <button className="primary">Appliquer à cette facture</button>
            </form>

            <form className="loyalty-card" onSubmit={payDebt}>
              <h3>Encaisser / rembourser dette</h3>
              <p>Enregistre un paiement client et réduit automatiquement le reste dû.</p>

              <select value={debtWorkOrderId} onChange={(e) => setDebtWorkOrderId(e.target.value)}>
                <option value="">Répartir sur les plus anciennes dettes</option>
                {outstandingOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.id} — {orderLabel(order)}
                  </option>
                ))}
              </select>

              <input
                placeholder="Montant encaissé"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
              />

              <button className="primary">Enregistrer paiement</button>
            </form>

            <div className="loyalty-card">
              <h3>Rappel de dette</h3>
              <p>Génère un message court à envoyer au client.</p>

              <button className="secondary-button" type="button" onClick={generateReminder}>
                Générer rappel
              </button>

              {reminderText && (
                <>
                  <textarea className="debt-reminder-box" readOnly value={reminderText} />

                  <button type="button" onClick={copyReminderText}>
                    Copier le rappel
                  </button>

                  {copyStatus && (
                    <p className="loyalty-success">{copyStatus}</p>
                  )}
                </>
              )}
            </div>

            <form className="loyalty-card" onSubmit={addPoints}>
              <h3>Ajouter points</h3>
              <p>À utiliser après paiement réel, recommandation ou geste validé.</p>

              <input
                placeholder="Montant service / main-d’œuvre"
                value={earnForm.service_amount}
                onChange={(e) => setEarnForm({ ...earnForm, service_amount: e.target.value })}
              />

              <input
                placeholder="Montant pièces"
                value={earnForm.parts_amount}
                onChange={(e) => setEarnForm({ ...earnForm, parts_amount: e.target.value })}
              />

              <input
                placeholder="Bonus points"
                value={earnForm.bonus_points}
                onChange={(e) => setEarnForm({ ...earnForm, bonus_points: e.target.value })}
              />

              <input
                placeholder="Raison"
                value={earnForm.reason}
                onChange={(e) => setEarnForm({ ...earnForm, reason: e.target.value })}
              />

              <button className="primary">Ajouter les points</button>
            </form>

            <form className="loyalty-card" onSubmit={adjustPoints}>
              <h3>Ajuster</h3>
              <p>Correction manuelle par le gérant : bonus, erreur, expiration ou geste commercial.</p>

              <input
                placeholder="Points : ex. 20 ou -20"
                value={adjustForm.points}
                onChange={(e) => setAdjustForm({ ...adjustForm, points: e.target.value })}
              />

              <input
                placeholder="Raison obligatoire"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              />

              <button className="primary">Ajuster</button>
            </form>
          </div>

          <div className="loyalty-history">
            <h3>Historique</h3>

            {transactions.length === 0 ? (
              <p>Aucune transaction fidélité.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Points</th>
                    <th>Montant</th>
                    <th>Facture</th>
                    <th>Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.created_at ? new Date(transaction.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{transaction.type}</td>
                      <td>{transaction.points}</td>
                      <td>{money(transaction.amount_reference)}</td>
                      <td>{transaction.work_order_id ? `#${transaction.work_order_id}` : '—'}</td>
                      <td>{transaction.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function LoyaltyStat({ label, value, highlight, danger, tier }) {
  return (
    <div className={`loyalty-stat ${highlight ? 'highlight' : ''} ${danger ? 'danger' : ''} ${tier ? `tier-${String(tier).toLowerCase()}` : ''}`}>
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  )
}
