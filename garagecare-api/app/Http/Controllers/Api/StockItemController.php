<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockItem;
use Illuminate\Http\Request;

class StockItemController extends Controller
{
    public function index()
    {
        return response()->json(['data' => StockItem::latest()->limit(100)->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:0'],
            'alert_threshold' => ['required', 'integer', 'min:0'],
            'unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        return response()->json(['message' => 'Article stock créé.', 'data' => StockItem::create($data)], 201);
    }

    public function update(Request $request, StockItem $stockItem)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'quantity' => ['sometimes', 'required', 'integer', 'min:0'],
            'alert_threshold' => ['sometimes', 'required', 'integer', 'min:0'],
            'unit_price' => ['sometimes', 'required', 'numeric', 'min:0'],
        ]);

        $stockItem->update($data);

        return response()->json(['message' => 'Article stock modifié.', 'data' => $stockItem]);
    }
}
