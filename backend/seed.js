require('dotenv').config({ path: process.env.HOME + '/billing-app/backend/.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const ItemMaster = require('./models/ItemMaster');
const TaxConfig = require('./models/TaxConfig');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // ── USERS ──────────────────────────────────────────────────────────────
  const users = [
    { name: 'Admin',    username: 'admin',  password: 'Admin@1234',  role: 'admin' },
    { name: 'Sales 1',  username: 'sales1', password: 'Sales@1234',  role: 'salesperson' },
    { name: 'Sales 2',  username: 'sales2', password: 'Sales@1234',  role: 'salesperson' }
  ];
  for (const u of users) {
    const exists = await User.findOne({ username: u.username });
    if (!exists) { await User.create(u); console.log('Created user:', u.username); }
    else console.log('User exists:', u.username);
  }

  // ── TAX CONFIG ─────────────────────────────────────────────────────────
  const taxExists = await TaxConfig.findOne({ fy: '2025-26' });
  if (!taxExists) {
    await TaxConfig.create({
      fy: '2025-26', isActive: true,
      taxes: [
        { name: 'CGST', rate: 1.5, isDefault: true, isOptional: false, applyOn: 'total', description: 'Central GST 1.5%' },
        { name: 'SGST', rate: 1.5, isDefault: true, isOptional: false, applyOn: 'total', description: 'State GST 1.5%' },
        { name: 'Making Charge GST', rate: 5, isDefault: false, isOptional: true, applyOn: 'makingCharge', description: 'GST on making charge' }
      ]
    });
    console.log('Created tax config for 2025-26');
  } else console.log('Tax config exists: 2025-26');

  // ── ITEM MASTER ────────────────────────────────────────────────────────
  const itemCount = await ItemMaster.countDocuments();
  if (itemCount === 0) {
    await ItemMaster.insertMany([
      { metal:'Gold', category:'Ornaments', itemType:'Bangle', subType:'Plain Bangle', displayName:'Gold Bangle - Plain', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:1 },
      { metal:'Gold', category:'Ornaments', itemType:'Bangle', subType:'Fancy Bangle', displayName:'Gold Bangle - Fancy', hsnCode:'7113', hasStoneWeight:true, hasMakingCharge:true, hasVatGrams:true, sortOrder:2 },
      { metal:'Gold', category:'Ornaments', itemType:'Chain', subType:'Plain Chain', displayName:'Gold Chain - Plain', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:3 },
      { metal:'Gold', category:'Ornaments', itemType:'Chain', subType:'Fancy Chain', displayName:'Gold Chain - Fancy', hsnCode:'7113', hasStoneWeight:true, hasMakingCharge:true, hasVatGrams:true, sortOrder:4 },
      { metal:'Gold', category:'Ornaments', itemType:'Necklace', subType:'Plain', displayName:'Gold Necklace - Plain', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:5 },
      { metal:'Gold', category:'Ornaments', itemType:'Necklace', subType:'Stone Set', displayName:'Gold Necklace - Stone', hsnCode:'7113', hasStoneWeight:true, hasMakingCharge:true, hasVatGrams:true, sortOrder:6 },
      { metal:'Gold', category:'Ornaments', itemType:'Ring', subType:'Plain Ring', displayName:'Gold Ring - Plain', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:7 },
      { metal:'Gold', category:'Ornaments', itemType:'Ring', subType:'Stone Ring', displayName:'Gold Ring - Stone', hsnCode:'7113', hasStoneWeight:true, hasMakingCharge:true, hasVatGrams:true, sortOrder:8 },
      { metal:'Gold', category:'Ornaments', itemType:'Earring', subType:'Plain', displayName:'Gold Earring - Plain', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:9 },
      { metal:'Gold', category:'Ornaments', itemType:'Earring', subType:'Stone Set', displayName:'Gold Earring - Stone', hsnCode:'7113', hasStoneWeight:true, hasMakingCharge:true, hasVatGrams:true, sortOrder:10 },
      { metal:'Gold', category:'Ornaments', itemType:'Anklet', subType:'Plain', displayName:'Gold Anklet', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:11 },
      { metal:'Gold', category:'Ornaments', itemType:'Pendant', subType:'Plain', displayName:'Gold Pendant - Plain', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:12 },
      { metal:'Gold', category:'Coins', itemType:'Coin', subType:'1gm', displayName:'Gold Coin 1gm', hsnCode:'7108', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:20 },
      { metal:'Gold', category:'Coins', itemType:'Coin', subType:'2gm', displayName:'Gold Coin 2gm', hsnCode:'7108', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:21 },
      { metal:'Gold', category:'Coins', itemType:'Coin', subType:'4gm', displayName:'Gold Coin 4gm', hsnCode:'7108', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:22 },
      { metal:'Gold', category:'Coins', itemType:'Coin', subType:'8gm', displayName:'Gold Coin 8gm', hsnCode:'7108', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:23 },
      { metal:'Gold', category:'Coins', itemType:'Biscuit', subType:'10gm', displayName:'Gold Biscuit 10gm', hsnCode:'7108', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:24 },
      { metal:'Gold', category:'Coins', itemType:'Biscuit', subType:'20gm', displayName:'Gold Biscuit 20gm', hsnCode:'7108', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:25 },
      { metal:'Gold', category:'Ready-made', itemType:'Bracelet', subType:'', displayName:'Gold Bracelet - Readymade', hsnCode:'7113', hasStoneWeight:true, hasMakingCharge:true, hasVatGrams:false, sortOrder:30 },
      { metal:'Silver', category:'Ornaments', itemType:'Anklet', subType:'', displayName:'Silver Anklet', hsnCode:'7113', hasStoneWeight:false, hasMakingCharge:true, hasVatGrams:true, sortOrder:40 },
      { metal:'Silver', category:'Coins', itemType:'Coin', subType:'10gm', displayName:'Silver Coin 10gm', hsnCode:'7106', defaultUnit:'piece', hasVatGrams:false, hasMakingCharge:false, sortOrder:41 }
    ]);
    console.log('Created item master list');
  } else console.log('Items exist, skipping. Count:', itemCount);

  await mongoose.disconnect();
  console.log('Seed complete!');
};

seed().catch(err => { console.error('Seed error:', err.message); process.exit(1); });
