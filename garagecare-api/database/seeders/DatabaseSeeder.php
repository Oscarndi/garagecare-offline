<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ServiceItem;
use App\Models\StockItem;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@garagecare.local'],
            ['name' => 'Admin GarageCare', 'password' => Hash::make('password'), 'role' => 'admin']
        );

        User::updateOrCreate(
            ['email' => 'agent@garagecare.local'],
            ['name' => 'Agent GarageCare', 'password' => Hash::make('password'), 'role' => 'agent']
        );

        $services = [
            ['name' => 'Vidange moteur', 'category' => 'Entretien', 'estimated_price' => 25000, 'estimated_duration' => 45, 'advice' => 'Vérifier la périodicité et le niveau d’huile.'],
            ['name' => 'Diagnostic électronique', 'category' => 'Diagnostic', 'estimated_price' => 35000, 'estimated_duration' => 60, 'advice' => 'Un voyant nécessite une lecture professionnelle.'],
            ['name' => 'Contrôle freins', 'category' => 'Sécurité', 'estimated_price' => 20000, 'estimated_duration' => 40, 'advice' => 'Éviter de rouler longtemps si le freinage fait du bruit.'],
            ['name' => 'Remplacement batterie', 'category' => 'Électricité', 'estimated_price' => 85000, 'estimated_duration' => 35, 'advice' => 'Contrôler la charge et les cosses avant remplacement.'],
            ['name' => 'Équilibrage pneus', 'category' => 'Train roulant', 'estimated_price' => 15000, 'estimated_duration' => 30, 'advice' => 'Une vibration peut venir d’un défaut d’équilibrage.'],
            ['name' => 'Contrôle climatisation', 'category' => 'Confort', 'estimated_price' => 30000, 'estimated_duration' => 50, 'advice' => 'Contrôler le froid produit et les fuites éventuelles.'],
        ];

        foreach ($services as $service) {
            ServiceItem::updateOrCreate(
                ['name' => $service['name']],
                $service + ['description' => $service['name'], 'is_active' => true]
            );
        }

        $customer = Customer::updateOrCreate(
            ['phone' => '690000111'],
            ['name' => 'M. Kamga', 'address' => 'Douala', 'notes' => 'Client de démonstration']
        );

        $vehicle = Vehicle::updateOrCreate(
            ['registration_number' => 'LT-234-AA'],
            [
                'customer_id' => $customer->id,
                'brand' => 'Toyota',
                'model' => 'Corolla',
                'year' => 2014,
                'color' => 'Gris',
                'mileage' => 175400,
                'fuel_type' => 'Essence',
            ]
        );

        foreach ([
            ['name' => 'Huile moteur', 'category' => 'Lubrifiant', 'quantity' => 10, 'alert_threshold' => 5, 'unit_price' => 12000],
            ['name' => 'Filtre à huile', 'category' => 'Filtration', 'quantity' => 4, 'alert_threshold' => 5, 'unit_price' => 5000],
            ['name' => 'Plaquettes frein', 'category' => 'Freinage', 'quantity' => 8, 'alert_threshold' => 3, 'unit_price' => 18000],
            ['name' => 'Batteries', 'category' => 'Électricité', 'quantity' => 3, 'alert_threshold' => 2, 'unit_price' => 65000],
        ] as $item) {
            StockItem::updateOrCreate(['name' => $item['name']], $item);
        }

        foreach ([
            ['label' => 'Électricité atelier', 'category' => 'électricité', 'amount' => 45000, 'expense_date' => now()->toDateString()],
            ['label' => 'Eau', 'category' => 'eau', 'amount' => 12000, 'expense_date' => now()->toDateString()],
        ] as $expense) {
            Expense::updateOrCreate(
                ['label' => $expense['label'], 'expense_date' => $expense['expense_date']],
                $expense
            );
        }

        $selected = ServiceItem::whereIn('name', ['Vidange moteur', 'Contrôle freins'])->get();

        WorkOrder::updateOrCreate(
            ['customer_id' => $customer->id, 'vehicle_id' => $vehicle->id, 'problem_description' => 'Bruit au freinage et entretien à prévoir.'],
            [
                'user_id' => $admin->id,
                'scheduled_at' => now()->addDay()->setTime(9, 30),
                'services_snapshot' => $selected->map(fn ($service) => [
                    'id' => $service->id,
                    'name' => $service->name,
                    'estimated_price' => (float) $service->estimated_price,
                ])->values()->all(),
                'estimated_amount' => $selected->sum('estimated_price'),
                'status' => 'propose',
            ]
        );
    }
}
