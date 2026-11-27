document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = window.__API_BASE__ || '';
    const addItemBtn = document.getElementById('addItemBtn');
    const itemsList = document.getElementById('itemsList');
    const generateBillBtn = document.getElementById('generateBillBtn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const emptyState = document.getElementById('emptyState');

    addItemBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'item-row flex gap-2';
        row.innerHTML = `
            <input type="text" placeholder="Item" class="item-name flex-1 px-3 py-2 border rounded-lg text-sm">
            <input type="number" placeholder="Qty" class="item-qty w-16 px-3 py-2 border rounded-lg text-sm">
            <input type="number" placeholder="Price" class="item-price w-20 px-3 py-2 border rounded-lg text-sm">
        `;
        itemsList.appendChild(row);
    });

    generateBillBtn.addEventListener('click', async () => {
        const customerName = document.getElementById('customerName').value;
        const rows = document.querySelectorAll('.item-row');
        const items = [];

        rows.forEach(row => {
            const name = row.querySelector('.item-name').value;
            const qty = parseFloat(row.querySelector('.item-qty').value);
            const price = parseFloat(row.querySelector('.item-price').value);

            if (name && qty && price) {
                items.push({ name, quantity: qty, price });
            }
        });

        if (!customerName || items.length === 0) {
            alert('Please enter customer name and at least one item.');
            return;
        }

        // UI State
        emptyState.classList.add('hidden');
        resultDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        generateBillBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/generate-bill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerName, items })
            });

            const result = await response.json();
            if (result.success) {
                renderBill(result.bill, result.ai);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to generate bill.');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBillBtn.disabled = false;
        }
    });

    function renderBill(bill, ai) {
        resultDiv.classList.remove('hidden');
        document.getElementById('resBillId').textContent = bill.billId;
        document.getElementById('resDate').textContent = new Date(bill.date).toLocaleDateString();
        document.getElementById('resCustomer').textContent = bill.customerName;

        const tableBody = document.getElementById('resTableBody');
        tableBody.innerHTML = bill.items.map(item => `
            <tr class="border-b border-slate-50">
                <td class="py-3">${item.name}</td>
                <td class="py-3">${item.quantity}</td>
                <td class="py-3">₹${item.price}</td>
                <td class="py-3 text-right font-medium">₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        document.getElementById('resSubtotal').textContent = `₹${bill.subtotal.toFixed(2)}`;
        document.getElementById('resTax').textContent = `₹${bill.tax.toFixed(2)}`;
        document.getElementById('resTotal').textContent = `₹${bill.total.toFixed(2)}`;

        document.getElementById('enExpl').textContent = ai.english.explanation;
        document.getElementById('knExpl').textContent = ai.kannada.explanation;
    }
});
