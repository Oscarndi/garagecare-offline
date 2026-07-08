<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssistantMessage;
use App\Models\ServiceItem;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AssistantController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => AssistantMessage::with(['customer', 'recommendedService'])->latest()->limit(100)->get(),
        ]);
    }

    public function message(Request $request)
    {
        $data = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'question' => ['required', 'string', 'max:2000'],
        ]);

        [$intent, $serviceQuery] = $this->detectIntent($data['question']);

        $service = $serviceQuery
            ? ServiceItem::where('is_active', true)->where('name', 'like', "%$serviceQuery%")->first()
            : null;

        $prudence = "Je peux vous orienter, mais je ne peux pas établir un diagnostic définitif à distance. Un technicien doit vérifier le véhicule avant toute décision de réparation.";

        if ($intent === 'hors_domaine') {
            $answer = "$prudence Votre demande ne correspond pas clairement aux services automobiles du catalogue. Merci de contacter le garage pour une vérification.";
        } elseif ($service) {
            $answer = "$prudence D’après votre description, le service recommandé est : {$service->name}. Conseil de base : {$service->advice}";
        } else {
            $answer = "$prudence Je n’ai pas trouvé de service actif correspondant exactement dans le catalogue. Le garage doit analyser la demande.";
        }

        $message = AssistantMessage::create([
            'customer_id' => $data['customer_id'] ?? null,
            'question' => $data['question'],
            'answer' => $answer,
            'intent' => $intent,
            'recommended_service_id' => $service?->id,
        ]);

        return response()->json([
            'message' => 'Demande assistant enregistrée.',
            'data' => $message->load('recommendedService'),
        ], 201);
    }

    private function detectIntent(string $question): array
    {
        $q = Str::lower($question);

        return match (true) {
            str_contains($q, 'vidange') || str_contains($q, 'huile') => ['vidange', 'Vidange'],
            str_contains($q, 'batterie') || str_contains($q, 'démarrage') || str_contains($q, 'demarrage') => ['batterie', 'Batterie'],
            str_contains($q, 'frein') || str_contains($q, 'plaquette') => ['freins', 'freins'],
            str_contains($q, 'voyant') || str_contains($q, 'diagnostic') || str_contains($q, 'électronique') || str_contains($q, 'electronique') => ['diagnostic', 'Diagnostic'],
            str_contains($q, 'pneu') || str_contains($q, 'vibration') || str_contains($q, 'équilibrage') || str_contains($q, 'equilibrage') => ['pneus', 'Équilibrage'],
            str_contains($q, 'clim') || str_contains($q, 'climatisation') => ['climatisation', 'climatisation'],
            default => ['hors_domaine', null],
        };
    }
}
