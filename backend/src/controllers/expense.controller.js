import { asyncHandler } from '../utils/asyncHandler.js';
import * as expenseService from '../services/expense.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await expenseService.listExpenses({
    ...req.query,
    userId: req.user._id,
    userRole: req.user.role,
  });
  res.json({ success: true, data: result });
});

export const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.user, req);
  res.status(201).json({ success: true, data: { expense } });
});

export const detail = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.params.id);
  res.json({ success: true, data: { expense } });
});

export const submit = asyncHandler(async (req, res) => {
  const expense = await expenseService.submitExpense(req.params.id, req.user, req);
  res.json({ success: true, data: { expense }, message: 'Expense submitted for approval.' });
});

export const approve = asyncHandler(async (req, res) => {
  const expense = await expenseService.approveExpense(req.params.id, req.body, req.user, req);
  const message = expense.status === 'approved' ? 'Expense fully approved and posted to ledger.' : 'Expense approved, forwarded to next approver.';
  res.json({ success: true, data: { expense }, message });
});

export const reject = asyncHandler(async (req, res) => {
  const expense = await expenseService.rejectExpense(req.params.id, req.body, req.user, req);
  res.json({ success: true, data: { expense }, message: 'Expense rejected.' });
});

export const pendingForMe = asyncHandler(async (req, res) => {
  const items = await expenseService.listPendingForUser(req.user);
  res.json({ success: true, data: { items } });
});

export const categories = asyncHandler(async (_req, res) => {
  const items = await expenseService.listExpenseCategories();
  res.json({ success: true, data: { items } });
});

export default { list, create, detail, submit, approve, reject, pendingForMe, categories };