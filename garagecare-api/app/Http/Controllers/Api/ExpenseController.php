<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Expense::latest('expense_date')->limit(100)->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:160'],
            'category' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'expense_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['message' => 'Charge créée.', 'data' => Expense::create($data)], 201);
    }

    public function update(Request $request, Expense $expense)
    {
        $data = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:160'],
            'category' => ['sometimes', 'required', 'string', 'max:80'],
            'amount' => ['sometimes', 'required', 'numeric', 'gt:0'],
            'expense_date' => ['sometimes', 'required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $expense->update($data);

        return response()->json(['message' => 'Charge modifiée.', 'data' => $expense]);
    }
}
