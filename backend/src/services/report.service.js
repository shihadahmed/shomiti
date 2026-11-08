import Member from '../models/Member.js';
import SavingsAccount from '../models/SavingsAccount.js';
import SavingsTransaction from '../models/SavingsTransaction.js';
import SavingsDue from '../models/SavingsDue.js';
import Expense from '../models/Expense.js';
import Payment from '../models/Payment.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { TRANSACTION_STATUS, TRANSACTION_TYPES, EXPENSE_STATUS, SAVINGS_DUE_STATUS } from '../config/constants.js';
import { formatMoney } from './savings.service.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function generateReport(type, from, to, query = {}) {
  const { page, limit, skip } = getPagination(query);
  
  const dateFilter = {
    createdAt: {
      $gte: new Date(from),
      $lte: (() => { const end = new Date(to); end.setHours(23, 59, 59, 999); return end; })(),
    },
  };

  let filter = { ...dateFilter };
  let items = [];
  let total = 0;

  switch (type) {
    case 'collection': {
      filter = { ...filter, status: TRANSACTION_STATUS.POSTED, type: TRANSACTION_TYPES.DEPOSIT };
      [items, total] = await Promise.all([
        SavingsTransaction.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('member', 'code fullName fullNameBn phone')
          .populate('account', 'accountNo type')
          .populate('postedBy', 'name')
          .lean(),
        SavingsTransaction.countDocuments(filter),
      ]);
      break;
    }
    
    case 'dues': {
      filter = { ...filter, status: { $in: [SAVINGS_DUE_STATUS.DUE, SAVINGS_DUE_STATUS.OVERDUE, SAVINGS_DUE_STATUS.PAID] } };
      [items, total] = await Promise.all([
        SavingsDue.find(filter)
          .sort({ dueDate: 1 })
          .skip(skip)
          .limit(limit)
          .populate('member', 'code fullName fullNameBn phone')
          .populate('payment', 'paymentNo status receiptNo')
          .lean(),
        SavingsDue.countDocuments(filter),
      ]);
      break;
    }
    
    case 'late-fee': {
      filter = { ...filter, status: { $in: [SAVINGS_DUE_STATUS.DUE, SAVINGS_DUE_STATUS.OVERDUE] }, lateFeePaisa: { $gt: 0 } };
      [items, total] = await Promise.all([
        SavingsDue.find(filter)
          .sort({ dueDate: 1 })
          .skip(skip)
          .limit(limit)
          .populate('member', 'code fullName fullNameBn phone')
          .lean(),
        SavingsDue.countDocuments(filter),
      ]);
      break;
    }
    
    case 'income-expense': {
      // Get both savings deposits (income) and expenses
      const [incomeItems, expenseItems] = await Promise.all([
        SavingsTransaction.find({ ...filter, status: TRANSACTION_STATUS.POSTED, type: TRANSACTION_TYPES.DEPOSIT })
          .sort({ createdAt: -1 })
          .lean(),
        Expense.find({ ...filter })
          .sort({ createdAt: -1 })
          .populate('createdBy', 'name')
          .lean(),
      ]);
      
      // Combine and sort by date
      items = [
        ...incomeItems.map(item => ({ ...item, _type: 'income', category: 'Savings Deposit' })),
        ...expenseItems.map(item => ({ ...item, _type: 'expense', category: item.category })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      total = items.length;
      // Apply pagination manually
      items = items.slice(skip, skip + limit);
      break;
    }
    
    case 'member': {
      filter = { ...filter };
      if (query.status) filter.status = query.status;
      if (query.search?.trim()) {
        const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
        filter.$or = [
          { code: regex },
          { fullName: regex },
          { fullNameBn: regex },
          { phone: regex },
        ];
      }
      
      [items, total] = await Promise.all([
        Member.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Member.countDocuments(filter),
      ]);
      
      // Add savings balance to each member
      const memberIds = items.map(m => m._id);
      const balances = await SavingsAccount.aggregate([
        { $match: { member: { $in: memberIds }, status: 'active' } },
        { $group: { _id: '$member', total: { $sum: '$balancePaisa' } } },
      ]);
      
      const balanceMap = new Map(balances.map(b => [String(b._id), b.total]));
      items = items.map(member => ({
        ...member,
        totalBalancePaisa: balanceMap.get(String(member._id)) || 0,
      }));
      break;
    }
    
    default:
      throw new Error(`Unknown report type: ${type}`);
  }

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function exportReport(type, from, to, format, query = {}) {
  // Get all data without pagination
  const result = await generateReport(type, from, to, { ...query, limit: 10000 });
  
  let filename = `${type}-report-${from}-to-${to}`;
  let contentType = 'text/csv';
  let data = '';
  
  if (format === 'csv') {
    filename += '.csv';
    contentType = 'text/csv';
    data = convertToCSV(result.items, type);
  } else {
    filename += '.json';
    contentType = 'application/json';
    data = JSON.stringify(result.items, null, 2);
  }
  
  return { data, filename, contentType };
}

function convertToCSV(items, type) {
  if (!items.length) return '';
  
  const headers = getCSVHeaders(type);
  const rows = items.map(item => getCSVRow(item, type));
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function getCSVHeaders(type) {
  switch (type) {
    case 'collection':
      return ['Date', 'Member', 'Type', 'Method', 'Amount', 'Receipt No', 'Status'];
    case 'dues':
      return ['Due No', 'Member', 'Period', 'Type', 'Principal', 'Late Fee', 'Total Due', 'Status', 'Due Date'];
    case 'late-fee':
      return ['Due No', 'Member', 'Period', 'Late Fee', 'Status', 'Due Date'];
    case 'income-expense':
      return ['Date', 'Category', 'Title', 'Type', 'Amount', 'Status'];
    case 'member':
      return ['Code', 'Name', 'Phone', 'Joined', 'Savings Balance', 'Status'];
    default:
      return Object.keys(items[0] || {});
  }
}

function getCSVRow(item, type) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB');
  };
  
  const formatAmount = (paisa) => {
    if (!paisa) return '0.00';
    return formatMoney(paisa);
  };
  
  switch (type) {
    case 'collection':
      return [
        formatDate(item.createdAt),
        item.member?.fullName || item.member?.fullNameBn || '',
        item.type,
        item.method || '',
        formatAmount(item.amountPaisa),
        item.receiptNo || '',
        item.status,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      
    case 'dues':
      return [
        item.dueNo || '',
        item.member?.fullName || item.member?.fullNameBn || '',
        item.period || '',
        item.savingsType || '',
        formatAmount(item.principalPaisa),
        formatAmount(item.lateFeePaisa),
        formatAmount(item.totalDuePaisa),
        item.status,
        formatDate(item.dueDate),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      
    case 'late-fee':
      return [
        item.dueNo || '',
        item.member?.fullName || item.member?.fullNameBn || '',
        item.period || '',
        formatAmount(item.lateFeePaisa),
        item.status,
        formatDate(item.dueDate),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      
    case 'income-expense':
      return [
        formatDate(item.createdAt),
        item.category || '',
        item.title || item.description || '',
        item._type || (item.type === TRANSACTION_TYPES.DEPOSIT ? 'Income' : 'Expense'),
        item._type === 'expense' ? `-${formatAmount(item.amountPaisa)}` : formatAmount(item.amountPaisa),
        item.status || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      
    case 'member':
      return [
        item.code || '',
        item.fullName || item.fullNameBn || '',
        item.phone || '',
        formatDate(item.createdAt),
        formatAmount(item.totalBalancePaisa),
        item.status || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      
    default:
      return Object.values(item).map(v => `"${String(v).replace(/"/g, '""')}"`);
  }
}

export default { generateReport, exportReport };