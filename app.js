import { db, auth } from "./firebase.js?v=20260719-7";
import {
  watchAuth,
  isInitialized,
  setupFirstAdmin,
  login,
  logout,
  createManagedUser,
  getUserProfile,
  can,
  DEFAULT_ADMIN_PERMISSIONS,
} from "./auth.js?v=20260719-7";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  runTransaction,
  increment,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const OFFICIAL_SHOP_NAME = `الأصيل للإطارات والزيوت المعدنية`;
const LOGO_URL = `https://raw.githubusercontent.com/BaselGhanem/Odai/refs/heads/main/Gemini_Generated_Image_102ux0102ux0102u.png`;
const state = {
  user: null,
  settings: {
    currency: `JOD`,
    shopName: OFFICIAL_SHOP_NAME,
    allowNegativeStock: false,
    paymentMethods: [`كاش`, `بطاقة`, `CliQ`, `تحويل بنكي`, `آجل`],
  },
  module: `dashboard`,
  cache: {},
  cart: [],
  reportRows: [],
  setupInProgress: false,
};
const DEFAULT_OPERATOR_PERMISSIONS = {
  dashboard: [`view`],
  pos: [`view`, `create`, `print`],
  products: [`view`],
  services: [`view`],
  customers: [`view`, `create`],
  invoices: [`view`, `print`],
};
const money = (value) =>
  `${Number(value || 0).toLocaleString(`ar-JO`, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.أ`;
const dateValue = (value) =>
  value?.toDate ? value.toDate() : value ? new Date(value) : null;
const dateText = (value) => {
  const d = dateValue(value);
  return d && !Number.isNaN(d.valueOf()) ? d.toLocaleDateString(`ar-JO`) : `—`;
};
const HTML_ENTITIES = new Map([
  [`&`, `&amp;`],
  [`<`, `&lt;`],
  [`>`, `&gt;`],
  [`'`, `&#39;`],
  [`"`, `&quot;`],
]);
const escapeHTML = (value) =>
  String(value ?? ``).replace(/[&<>'"]/g, (char) => HTML_ENTITIES.get(char));
const todayISO = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};
const monthStart = () => `${todayISO().slice(0, 7)}-01`;
const NAV = [
  [`dashboard`, `⌂`, `لوحة التحكم`],
  [`pos`, `▣`, `نقطة البيع`],
  [`products`, `◫`, `المنتجات`],
  [`services`, `⚙`, `الخدمات`],
  [`offers`, `★`, `العروض`],
  [`purchases`, `⇣`, `المشتريات`],
  [`rentals`, `↔`, `الإيجارات`],
  [`customers`, `♙`, `الزبائن`],
  [`suppliers`, `♜`, `الموردون`],
  [`employees`, `♟`, `الموظفون`],
  [`salaries`, `₿`, `الرواتب`],
  [`advances`, `⇢`, `السلف`],
  [`expenses`, `−`, `المصاريف`],
  [`invoices`, `▤`, `الفواتير`],
  [`reports`, `▥`, `التقارير`],
  [`users`, `♚`, `المستخدمون`],
  [`settings`, `⚙`, `الإعدادات`],
  [`auditLogs`, `◷`, `سجل التدقيق`],
];
const META = {
  products: {
    title: `المنتجات`,
    singular: `منتج`,
    collection: `products`,
    search: [`name`, `sku`, `category`],
    columns: [
      [`name`, `المنتج`],
      [`sku`, `الرمز`],
      [`category`, `الفئة`],
      [`sellingPrice`, `سعر البيع`, `money`],
      [`stock`, `المخزون`],
      [`minimumStock`, `الحد الأدنى`],
      [`active`, `الحالة`, `bool`],
    ],
    fields: [
      [`name`, `اسم المنتج`, `text`, true],
      [`sku`, `الباركود / SKU`, `text`, true],
      [
        `category`,
        `الفئة`,
        `select`,
        true,
        [
          `كوشوك جديد`,
          `كوشوك مستعمل`,
          `زيوت`,
          `اكسسوارات`,
          `زينة سيارات`,
          `فرش سيارات`,
          `مواد تأجير`,
          `أخرى`,
        ],
      ],
      [`subcategory`, `الفئة الفرعية`, `text`],
      [`brand`, `العلامة التجارية`, `text`],
      [`size`, `القياس / العيار`, `text`],
      [`unit`, `الوحدة`, `text`],
      [`costPrice`, `سعر التكلفة`, `number`, true],
      [`sellingPrice`, `سعر البيع`, `number`, true],
      [`stock`, `الرصيد الحالي`, `number`, true],
      [`minimumStock`, `الحد الأدنى`, `number`],
      [`location`, `الموقع`, `text`],
      [`supplier`, `المورد`, `text`],
      [`usedItem`, `مستعمل`, `checkbox`],
      [`rentable`, `قابل للتأجير`, `checkbox`],
      [`active`, `نشط`, `checkbox`],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  services: {
    title: `الخدمات`,
    singular: `خدمة`,
    collection: `services`,
    search: [`name`, `category`],
    columns: [
      [`name`, `الخدمة`],
      [`category`, `الفئة`],
      [`price`, `السعر`, `money`],
      [`cost`, `التكلفة`, `money`],
      [`active`, `الحالة`, `bool`],
    ],
    fields: [
      [`name`, `اسم الخدمة`, `text`, true],
      [
        `category`,
        `الفئة`,
        `select`,
        true,
        [`غيار زيت`, `ترصيص`, `بناشر`, `تركيب`, `فحص`, `أخرى`],
      ],
      [`price`, `السعر`, `number`, true],
      [`cost`, `التكلفة`, `number`],
      [`duration`, `المدة التقديرية بالدقائق`, `number`],
      [`active`, `نشطة`, `checkbox`],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  offers: {
    title: `عروض الزيوت والباقات`,
    singular: `عرض`,
    collection: `offers`,
    search: [`name`, `productName`],
    columns: [
      [`name`, `العرض`],
      [`productName`, `المنتج`],
      [`offerPrice`, `سعر العرض`, `money`],
      [`startDate`, `من`, `date`],
      [`endDate`, `إلى`, `date`],
      [`active`, `الحالة`, `bool`],
    ],
    fields: [
      [`name`, `اسم العرض`, `text`, true],
      [`productName`, `منتج الزيت`, `text`, true],
      [`oilSize`, `العيار`, `text`],
      [`offerPrice`, `سعر العرض`, `number`, true],
      [`includesOilChange`, `يشمل غيار الزيت`, `checkbox`],
      [`startDate`, `تاريخ البداية`, `date`, true],
      [`endDate`, `تاريخ النهاية`, `date`, true],
      [`quantityLimit`, `حد الكمية`, `number`],
      [`active`, `نشط`, `checkbox`],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  customers: {
    title: `الزبائن`,
    singular: `زبون`,
    collection: `customers`,
    search: [`name`, `phone`, `plate`],
    columns: [
      [`name`, `الاسم`],
      [`phone`, `الهاتف`],
      [`plate`, `رقم المركبة`],
      [`carType`, `نوع السيارة`],
      [`balance`, `الرصيد`, `money`],
    ],
    fields: [
      [`name`, `اسم الزبون`, `text`, true],
      [`phone`, `الهاتف`, `tel`],
      [`plate`, `رقم المركبة`, `text`],
      [`carType`, `نوع السيارة`, `text`],
      [`balance`, `الرصيد الافتتاحي`, `number`],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  suppliers: {
    title: `الموردون`,
    singular: `مورد`,
    collection: `suppliers`,
    search: [`name`, `phone`, `contactPerson`],
    columns: [
      [`name`, `المورد`],
      [`phone`, `الهاتف`],
      [`contactPerson`, `مسؤول الاتصال`],
      [`balance`, `الرصيد المستحق`, `money`],
    ],
    fields: [
      [`name`, `اسم المورد`, `text`, true],
      [`phone`, `الهاتف`, `tel`],
      [`address`, `العنوان`, `text`],
      [`contactPerson`, `مسؤول الاتصال`, `text`],
      [`balance`, `الرصيد الافتتاحي`, `number`],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  employees: {
    title: `الموظفون`,
    singular: `موظف`,
    collection: `employees`,
    search: [`name`, `phone`, `jobTitle`],
    columns: [
      [`name`, `الموظف`],
      [`jobTitle`, `المسمى`],
      [`phone`, `الهاتف`],
      [`monthlySalary`, `الراتب`, `money`],
      [`status`, `الحالة`],
    ],
    fields: [
      [`name`, `اسم الموظف`, `text`, true],
      [`phone`, `الهاتف`, `tel`],
      [`jobTitle`, `المسمى الوظيفي`, `text`],
      [`monthlySalary`, `الراتب الشهري`, `number`, true],
      [`startDate`, `تاريخ المباشرة`, `date`],
      [`status`, `الحالة`, `select`, true, [`نشط`, `موقوف`, `منتهي`]],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  salaries: {
    title: `الرواتب`,
    singular: `دفعة راتب`,
    collection: `salaries`,
    search: [`employeeName`, `month`],
    columns: [
      [`employeeName`, `الموظف`],
      [`month`, `الشهر`],
      [`salaryAmount`, `الراتب`, `money`],
      [`deductions`, `الخصومات`, `money`],
      [`advancesDeducted`, `خصم السلف`, `money`],
      [`netSalary`, `الصافي`, `money`],
      [`paymentDate`, `تاريخ الدفع`, `date`],
    ],
    fields: [
      [`employeeName`, `اسم الموظف`, `text`, true],
      [`month`, `الشهر`, `month`, true],
      [`salaryAmount`, `الراتب`, `number`, true],
      [`deductions`, `الخصومات`, `number`],
      [`advancesDeducted`, `السلف المخصومة`, `number`],
      [`paymentDate`, `تاريخ الدفع`, `date`, true],
      [
        `paymentMethod`,
        `طريقة الدفع`,
        `select`,
        true,
        [`كاش`, `بطاقة`, `CliQ`, `تحويل بنكي`],
      ],
      [`notes`, `ملاحظات`, `textarea`],
    ],
    compute: (data) => ({
      ...data,
      netSalary:
        Number(data.salaryAmount || 0) -
        Number(data.deductions || 0) -
        Number(data.advancesDeducted || 0),
    }),
  },
  advances: {
    title: `السلف`,
    singular: `سلفة`,
    collection: `advances`,
    search: [`employeeName`, `reason`],
    columns: [
      [`employeeName`, `الموظف`],
      [`date`, `التاريخ`, `date`],
      [`amount`, `المبلغ`, `money`],
      [`reason`, `السبب`],
      [`status`, `الحالة`],
    ],
    fields: [
      [`employeeName`, `اسم الموظف`, `text`, true],
      [`date`, `التاريخ`, `date`, true],
      [`amount`, `المبلغ`, `number`, true],
      [`reason`, `السبب`, `text`],
      [`status`, `الحالة`, `select`, true, [`معلقة`, `مخصومة`]],
      [`deductionMonth`, `شهر الخصم`, `month`],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
  expenses: {
    title: `المصاريف`,
    singular: `مصروف`,
    collection: `expenses`,
    search: [`category`, `notes`],
    columns: [
      [`date`, `التاريخ`, `date`],
      [`category`, `الفئة`],
      [`type`, `النوع`],
      [`amount`, `المبلغ`, `money`],
      [`paymentMethod`, `الدفع`],
    ],
    fields: [
      [`date`, `تاريخ المصروف`, `date`, true],
      [
        `category`,
        `الفئة`,
        `select`,
        true,
        [
          `إيجار`,
          `كهرباء`,
          `ماء`,
          `إنترنت`,
          `رواتب`,
          `صيانة`,
          `نقل`,
          `مصاريف يومية`,
          `أخرى`,
        ],
      ],
      [`type`, `النوع`, `select`, true, [`ثابت`, `متغير`]],
      [`amount`, `المبلغ`, `number`, true],
      [
        `paymentMethod`,
        `طريقة الدفع`,
        `select`,
        true,
        [`كاش`, `بطاقة`, `CliQ`, `تحويل بنكي`],
      ],
      [`notes`, `ملاحظات`, `textarea`],
    ],
  },
};
const PAGE_TITLES = {
  dashboard: [`نظرة عامة`, `لوحة التحكم`],
  pos: [`بيع سريع`, `نقطة البيع`],
  purchases: [`توريد المخزون`, `المشتريات`],
  rentals: [`متابعة العهد`, `الإيجارات`],
  invoices: [`سجل العمليات`, `الفواتير`],
  reports: [`تحليل الأداء`, `التقارير`],
  users: [`إدارة الوصول`, `المستخدمون والصلاحيات`],
  settings: [`ضبط النظام`, `الإعدادات`],
  auditLogs: [`الرقابة`, `سجل التدقيق`],
};
const TOUR_COPY = {
  dashboard: [
    `لوحة التحكم`,
    `هنا ترى ملخص المبيعات والمصاريف والمخزون والتنبيهات المحدثة تلقائيا.`,
  ],
  pos: [
    `نقطة البيع`,
    `اختر المنتجات والخدمات، راجع السلة، ثم احفظ الفاتورة. المخزون والصندوق يتحدثان تلقائيا.`,
  ],
  products: [
    `المنتجات`,
    `أضف الإطارات والزيوت والمواد، وحدد السعر والمخزون والحد الأدنى لكل منتج.`,
  ],
  services: [
    `الخدمات`,
    `عرّف خدمات المحل وأسعارها مثل غيار الزيت والترصيص والتركيب.`,
  ],
  offers: [`العروض`, `أنشئ عروض الزيوت والباقات وحدد فترة صلاحيتها وسعرها.`],
  purchases: [
    `المشتريات`,
    `سجّل فاتورة المورد هنا؛ ستُضاف الكمية إلى المخزون ويُسجّل الدفع تلقائيا.`,
  ],
  rentals: [
    `الإيجارات`,
    `سجّل خروج المادة وموعد إرجاعها، ثم تابع حالتها حتى الاستلام.`,
  ],
  customers: [
    `الزبائن`,
    `احفظ بيانات الزبون والمركبة والرصيد لتسريع البيع والمتابعة.`,
  ],
  suppliers: [
    `الموردون`,
    `تابع بيانات الموردين والأرصدة المستحقة الناتجة عن المشتريات.`,
  ],
  employees: [
    `الموظفون`,
    `أدر بيانات العاملين والراتب الشهري والحالة الوظيفية.`,
  ],
  salaries: [
    `الرواتب`,
    `سجّل الدفعات والخصومات والسلف؛ حركة الصندوق تُنشأ تلقائيا.`,
  ],
  advances: [`السلف`, `سجّل سلف الموظفين وشهر الخصم وحالة كل سلفة.`],
  expenses: [
    `المصاريف`,
    `سجّل المصروف وطريقة دفعه؛ يُخصم من الصندوق تلقائيا دون إغلاق يومي.`,
  ],
  invoices: [
    `الفواتير`,
    `راجع عمليات البيع، اطبع الفواتير أو صدّر السجل حسب صلاحيتك.`,
  ],
  reports: [
    `التقارير`,
    `اختر الفترة المطلوبة لعرض نتائج المبيعات والأرباح والمصاريف.`,
  ],
  users: [
    `المستخدمون والصلاحيات`,
    `المدير فقط ينشئ الحسابات من الموقع ويحدد دور كل مستخدم وصلاحياته.`,
  ],
  settings: [
    `الإعدادات`,
    `اضبط اسم المحل والعملات وطرق الدفع وخيارات المخزون من هنا.`,
  ],
  auditLogs: [
    `سجل التدقيق`,
    `راجع من أضاف أو عدّل أو عطّل أي سجل داخل النظام.`,
  ],
};
let activeTour = null;

function showDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) dialog.close();
  document.documentElement.classList.add(`dialog-open`);
  document.body.classList.add(`dialog-open`);
  dialog.showModal();
}
function unlockDialogScroll() {
  if (document.querySelector(`dialog[open]`)) return;
  document.documentElement.classList.remove(`dialog-open`);
  document.body.classList.remove(`dialog-open`);
}
function closeEntityDialog() {
  const dialog = $(`#entity-dialog`);
  if (dialog?.open) dialog.close();
}
function validForm(selector) {
  const form = $(selector);
  if (!form) {
    toast(`تعذر تحميل نموذج النافذة. أغلقها ثم أعد فتحها.`, `error`);
    return null;
  }
  return form.reportValidity() ? form : null;
}
function tourKey(module) {
  return `aseel-tour-v1:${state.user?.id || `guest`}:${module}`;
}
function tourSteps(module) {
  const [title, intro] = TOUR_COPY[module] || [
    `شرح الصفحة`,
    `تعرف على أهم الأدوات في هذه الصفحة.`,
  ];
  const steps = [{ selector: `#page`, title, text: intro }];
  if (META[module])
    steps.push(
      {
        selector: `.toolbar`,
        title: `البحث والتصفية`,
        text: `استخدم البحث والحالة للوصول إلى السجل المطلوب بسرعة.`,
      },
      {
        selector: `#entity-table`,
        title: `السجلات والإجراءات`,
        text: `من هنا تراجع البيانات وتعدلها أو تعطلها حسب صلاحيتك.`,
      },
    );
  else if (module === `dashboard`)
    steps.push(
      {
        selector: `.stats-grid`,
        title: `المؤشرات`,
        text: `هذه الأرقام تُحسب تلقائيا من عمليات الموقع ولا تحتاج إلى إغلاق يومي.`,
      },
      {
        selector: `.split`,
        title: `المتابعة السريعة`,
        text: `تابع اتجاه المبيعات وتنبيهات المخزون من هذا القسم.`,
      },
    );
  else if (module === `pos`)
    steps.push(
      {
        selector: `.toolbar`,
        title: `ابحث واختر`,
        text: `ابحث عن منتج أو خدمة ثم اضغط عليه لإضافته إلى الفاتورة.`,
      },
      {
        selector: `#product-grid`,
        title: `المنتجات والخدمات`,
        text: `تعرض البطاقات السعر والكمية المتوفرة قبل الإضافة.`,
      },
      {
        selector: `.cart`,
        title: `إتمام الفاتورة`,
        text: `حدد الزبون والدفع، ويمكنك وضع سعر وحدة خاص لهذه الفاتورة فقط، ثم احفظ؛ المخزون والصندوق يتحدثان تلقائيا.`,
      },
    );
  else if (module === `reports`)
    steps.push(
      {
        selector: `.filters`,
        title: `فترة التقرير`,
        text: `غيّر تاريخ البداية والنهاية لتحديث النتائج مباشرة.`,
      },
      {
        selector: `#report-output`,
        title: `نتائج التقرير`,
        text: `راجع المبيعات والربح والمصاريف، ثم اطبع التقرير أو صدّره.`,
      },
    );
  else if (module === `settings`)
    steps.push({
      selector: `#settings-form`,
      title: `خيارات النظام`,
      text: `عدّل الخيارات المطلوبة ثم اضغط حفظ الإعدادات.`,
    });
  else
    steps.push(
      {
        selector: `.panel-head`,
        title: `أدوات الصفحة`,
        text: `تجد هنا زر الإضافة أو التصدير المتاح حسب صلاحيتك.`,
      },
      {
        selector: `.table-wrap`,
        title: `السجلات`,
        text: `راجع جميع الحركات والتفاصيل والإجراءات المتاحة في هذا الجدول.`,
      },
    );
  return steps.filter((step) => document.querySelector(step.selector));
}
function renderTour() {
  if (!activeTour) return;
  $$(`.tour-target`).forEach((element) =>
    element.classList.remove(`tour-target`),
  );
  const step = activeTour.steps[activeTour.index];
  const target = $(step.selector);
  target?.classList.add(`tour-target`);
  target?.scrollIntoView({ behavior: `smooth`, block: `center` });
  $(`#tour-title`).textContent = step.title;
  $(`#tour-text`).textContent = step.text;
  $(`#tour-progress`).textContent =
    `${activeTour.index + 1} من ${activeTour.steps.length}`;
  $(`#tour-prev`).disabled = activeTour.index === 0;
  $(`#tour-next`).textContent =
    activeTour.index === activeTour.steps.length - 1 ? `إنهاء` : `التالي`;
  $(`#tour-overlay`).classList.remove(`hidden`);
}
function endTour(markSeen = true) {
  if (!activeTour) return;
  const module = activeTour.module;
  $$(`.tour-target`).forEach((element) =>
    element.classList.remove(`tour-target`),
  );
  $(`#tour-overlay`).classList.add(`hidden`);
  activeTour = null;
  if (markSeen)
    try {
      localStorage.setItem(tourKey(module), `seen`);
    } catch {}
}
function startTour(module, force = false) {
  if (activeTour) endTour(true);
  if (!force)
    try {
      if (localStorage.getItem(tourKey(module))) return;
    } catch {}
  const steps = tourSteps(module);
  if (!steps.length) return;
  activeTour = { module, steps, index: 0 };
  renderTour();
}

function toast(message, type = `success`) {
  const el = document.createElement(`div`);
  el.className = `toast ${type === `error` ? `error` : ``}`;
  el.textContent = message;
  $(`#toast-region`).append(el);
  setTimeout(() => el.remove(), 3500);
}
function readableError(error) {
  console.error(error);
  const code = error?.code || ``;
  if (code.includes(`invalid-credential`))
    return `البريد الإلكتروني أو كلمة المرور غير صحيحة`;
  if (code.includes(`email-already-in-use`))
    return `البريد الإلكتروني مستخدم مسبقا`;
  if (code.includes(`invalid-email`)) return `صيغة البريد الإلكتروني غير صحيحة`;
  if (code.includes(`weak-password`))
    return `كلمة المرور يجب أن تتكون من 6 أحرف على الأقل`;
  if (code.includes(`too-many-requests`))
    return `محاولات كثيرة. انتظر قليلا ثم أعد المحاولة`;
  if (code.includes(`permission-denied`))
    return `لا توجد صلاحية لتنفيذ هذه العملية. انشر أحدث قواعد Firestore أولا`;
  if (code.includes(`network`)) return `تعذر الاتصال. تحقق من الإنترنت`;
  return error?.message || `حدث خطأ غير متوقع`;
}
async function audit(action, module, before = null, after = null) {
  try {
    await addDoc(collection(db, `auditLogs`), {
      action,
      module,
      userId: state.user.id,
      userName: state.user.name,
      before,
      after,
      device: navigator.userAgent.slice(0, 250),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: state.user.id,
      isDeleted: false,
    });
  } catch (error) {
    console.warn(`Audit failed`, error);
  }
}
async function loadSettings() {
  const snap = await getDoc(doc(db, `settings`, `general`));
  if (snap.exists()) {
    const saved = snap.data();
    state.settings = {
      ...state.settings,
      ...saved,
      shopName:
        saved.shopName && saved.shopName !== `نظام عدي`
          ? saved.shopName
          : OFFICIAL_SHOP_NAME,
    };
  }
}
function allowedNav() {
  return NAV.filter(([module]) => can(state.user, module, `view`));
}
function renderNav() {
  const nav = $(`#main-nav`);
  nav.innerHTML = allowedNav()
    .map(
      ([key, icon, label]) =>
        `<button class="nav-item ${state.module === key ? `active` : ``}" data-module="${key}"><span>${icon}</span>${label}</button>`,
    )
    .join(``);
  nav.onclick = (event) => {
    const button = event.target.closest(`[data-module]`);
    if (button) navigate(button.dataset.module);
  };
}
function setHeader(module) {
  const [kicker, title] = PAGE_TITLES[module] || [
    `إدارة البيانات`,
    META[module]?.title || module,
  ];
  $(`#page-kicker`).textContent = kicker;
  $(`#page-title`).textContent = title;
  $(`#quick-sale-btn`).classList.toggle(
    `hidden`,
    module === `pos` || !can(state.user, `pos`, `create`),
  );
}
async function navigate(module) {
  if (!can(state.user, module, `view`)) {
    toast(`لا توجد صلاحية لفتح هذه الوحدة`, `error`);
    return;
  }
  if (activeTour) endTour(true);
  state.module = module;
  renderNav();
  setHeader(module);
  $(`#page`).innerHTML =
    `<div class="panel empty"><div class="spinner"></div><strong>جاري تحميل البيانات</strong></div>`;
  try {
    if (META[module]) await renderEntityPage(module);
    else if (module === `dashboard`) await renderDashboard();
    else if (module === `pos`) await renderPOS();
    else if (module === `purchases`) await renderPurchases();
    else if (module === `rentals`) await renderRentals();
    else if (module === `invoices`) await renderInvoices();
    else if (module === `reports`) await renderReports();
    else if (module === `users`) await renderUsers();
    else if (module === `settings`) await renderSettings();
    else if (module === `auditLogs`) await renderAudit();
    setTimeout(() => {
      if (state.module === module) startTour(module);
    }, 250);
  } catch (error) {
    $(`#page`).innerHTML =
      `<div class="panel empty"><strong>تعذر تحميل الصفحة</strong>${escapeHTML(readableError(error))}</div>`;
  }
}
async function fetchRecent(collectionName, count = 200) {
  const q = query(
    collection(db, collectionName),
    orderBy(`createdAt`, `desc`),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !item.isDeleted);
}
function valueCell(value, type) {
  if (type === `money`) return money(value);
  if (type === `date`) return dateText(value);
  if (type === `bool`)
    return `<span class="badge ${value ? `success` : `danger`}">${value ? `نشط` : `موقوف`}</span>`;
  return escapeHTML(value ?? `—`);
}
async function renderEntityPage(module) {
  const meta = META[module];
  let rows = await fetchRecent(meta.collection);
  state.cache[module] = rows;
  const addButton = can(state.user, module, `create`)
    ? `<button class="btn primary" data-add>إضافة ${meta.singular}</button>`
    : ``;
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>${meta.title}</h2><div class="panel-actions"><button class="btn ghost" data-export>تصدير CSV</button>${addButton}</div></div><div class="toolbar"><input id="entity-search" placeholder="بحث سريع…"><select id="entity-status"><option value="all">كل الحالات</option><option value="active">نشط فقط</option><option value="inactive">موقوف فقط</option></select><span></span><button class="btn ghost" data-clear>مسح الفلاتر</button></div><div id="entity-table"></div></section>`;
  const draw = () => {
    const term = $(`#entity-search`).value.trim().toLowerCase();
    const status = $(`#entity-status`).value;
    const filtered = rows
      .filter((row) =>
        meta.search.some((key) =>
          String(row[key] ?? ``)
            .toLowerCase()
            .includes(term),
        ),
      )
      .filter(
        (row) =>
          status === `all` ||
          (status === `active` ? row.active !== false : row.active === false),
      );
    $(`#entity-table`).innerHTML = tableHTML(meta, filtered, module);
  };
  draw();
  $(`#entity-search`).oninput = draw;
  $(`#entity-status`).onchange = draw;
  $(`[data-clear]`).onclick = () => {
    $(`#entity-search`).value = ``;
    $(`#entity-status`).value = `all`;
    draw();
  };
  $(`[data-export]`).onclick = () => exportCSV(rows, meta.columns, meta.title);
  const add = $(`[data-add]`);
  if (add) add.onclick = () => openEntityForm(module);
  $(`#entity-table`).onclick = (event) => {
    const edit = event.target.closest(`[data-edit]`);
    const remove = event.target.closest(`[data-delete]`);
    if (edit)
      openEntityForm(
        module,
        rows.find((row) => row.id === edit.dataset.edit),
      );
    if (remove)
      softDelete(
        module,
        rows.find((row) => row.id === remove.dataset.delete),
      );
  };
}
function tableHTML(meta, rows, module) {
  if (!rows.length)
    return `<div class="empty"><strong>لا توجد بيانات</strong>أضف أول سجل أو غيّر معايير البحث.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${meta.columns.map(([, label]) => `<th>${label}</th>`).join(``)}<th>الإجراءات</th></tr></thead><tbody>${rows.map((row) => `<tr>${meta.columns.map(([key, , type]) => `<td>${valueCell(row[key], type)}</td>`).join(``)}<td><div class="panel-actions">${can(state.user, module, `edit`) ? `<button class="btn ghost small" data-edit="${row.id}">تعديل</button>` : ``}${can(state.user, module, `delete`) ? `<button class="btn small danger" data-delete="${row.id}">تعطيل</button>` : ``}</div></td></tr>`).join(``)}</tbody></table></div>`;
}
function fieldHTML([key, label, type, required, options], value) {
  const req = required ? `required` : ``;
  const full = type === `textarea` ? `full` : ``;
  if (type === `select`)
    return `<label class="${full}">${label}<select name="${key}" ${req}>${(options || []).map((option) => `<option ${value === option ? `selected` : ``}>${option}</option>`).join(``)}</select></label>`;
  if (type === `textarea`)
    return `<label class="${full}">${label}<textarea name="${key}" ${req}>${escapeHTML(value || ``)}</textarea></label>`;
  if (type === `checkbox`)
    return `<label>${label}<select name="${key}"><option value="true" ${value !== false ? `selected` : ``}>نعم</option><option value="false" ${value === false ? `selected` : ``}>لا</option></select></label>`;
  return `<label>${label}<input name="${key}" type="${type}" value="${escapeHTML(value ?? ``)}" ${type === `number` ? `step="0.01" min="0"` : ``} ${req}></label>`;
}
function openEntityForm(module, row = null) {
  const meta = META[module];
  $(`#dialog-title`).textContent =
    `${row ? `تعديل` : `إضافة`} ${meta.singular}`;
  $(`#dialog-body`).innerHTML =
    `<form id="entity-form" class="form-grid">${meta.fields.map((field) => fieldHTML(field, row?.[field[0]])).join(``)}</form>`;
  const dialog = $(`#entity-dialog`);
  showDialog(dialog);
  $(`#dialog-save`).onclick = async (event) => {
    event.preventDefault();
    const form = validForm(`#entity-form`);
    if (!form) return;
    const data = Object.fromEntries(new FormData(form));
    meta.fields.forEach(([key, , type]) => {
      if (type === `number`) data[key] = Number(data[key] || 0);
      if (type === `checkbox`) data[key] = data[key] === `true`;
    });
    const computed = meta.compute ? meta.compute(data) : data;
    const saveButton = $(`#dialog-save`);
    saveButton.disabled = true;
    try {
      if (row) {
        await updateDoc(doc(db, meta.collection, row.id), {
          ...computed,
          updatedAt: serverTimestamp(),
          updatedBy: state.user.id,
        });
        await audit(`edit`, module, row, computed);
      } else {
        const recordRef = doc(collection(db, meta.collection));
        const batch = writeBatch(db);
        batch.set(recordRef, {
          ...computed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: state.user.id,
          updatedBy: state.user.id,
          isDeleted: false,
        });
        const cashAmounts = {
          expenses: -Number(computed.amount || 0),
          salaries: -Number(computed.netSalary || 0),
          advances: -Number(computed.amount || 0),
        };
        if (module in cashAmounts)
          batch.set(doc(collection(db, `cashMovements`)), {
            type: module,
            amount: cashAmounts[module],
            paymentMethod: computed.paymentMethod || `كاش`,
            referenceId: recordRef.id,
            notes: computed.notes || ``,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: state.user.id,
            isDeleted: false,
          });
        await batch.commit();
        await audit(`create`, module, null, computed);
      }
      dialog.close();
      toast(`تم الحفظ بنجاح`);
      navigate(module);
    } catch (error) {
      toast(readableError(error), `error`);
    } finally {
      saveButton.disabled = false;
    }
  };
}
async function softDelete(module, row) {
  const ok = await confirmAction(
    `تعطيل السجل`,
    `سيبقى السجل محفوظا في سجل النظام ولن يظهر في القوائم النشطة.`,
  );
  if (!ok) return;
  try {
    await updateDoc(doc(db, META[module].collection, row.id), {
      isDeleted: true,
      active: false,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.id,
    });
    await audit(`soft-delete`, module, row, null);
    toast(`تم تعطيل السجل`);
    navigate(module);
  } catch (error) {
    toast(readableError(error), `error`);
  }
}
function confirmAction(title, message) {
  return new Promise((resolve) => {
    const dialog = $(`#confirm-dialog`);
    dialog.returnValue = `cancel`;
    $(`#confirm-title`).textContent = title;
    $(`#confirm-message`).textContent = message;
    showDialog(dialog);
    dialog.onclose = () => resolve(dialog.returnValue === `confirm`);
  });
}

async function renderDashboard() {
  const [sales, expenses, purchases, products, rentals] = await Promise.all([
    fetchRecent(`sales`, 100),
    fetchRecent(`expenses`, 100),
    fetchRecent(`purchases`, 100),
    fetchRecent(`products`, 300),
    fetchRecent(`rentals`, 100),
  ]);
  const completedSales = sales.filter((row) => row.status !== `ملغاة`);
  const start = new Date(`${monthStart()}T00:00:00`);
  const inMonth = (row) =>
    dateValue(row.date || row.purchaseDate || row.createdAt) >= start;
  const monthSales = completedSales
    .filter(inMonth)
    .reduce((sum, row) => sum + Number(row.netTotal || 0), 0);
  const todaySales = completedSales
    .filter(
      (row) =>
        dateText(row.createdAt) === new Date().toLocaleDateString(`ar-JO`),
    )
    .reduce((sum, row) => sum + Number(row.netTotal || 0), 0);
  const monthExpenses = expenses
    .filter(inMonth)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthPurchases = purchases
    .filter(inMonth)
    .reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
  const grossProfit = completedSales
    .filter(inMonth)
    .reduce((sum, row) => sum + Number(row.grossProfit || 0), 0);
  const low = products.filter(
    (item) =>
      item.active !== false &&
      Number(item.stock) <=
        Number(item.minimumStock || state.settings.lowStockThreshold || 5),
  );
  const overdue = rentals.filter(
    (item) => item.status === `نشط` && item.expectedReturnDate < todayISO(),
  );
  const stats = [
    [
      `مبيعات اليوم`,
      money(todaySales),
      `${completedSales.filter((row) => dateText(row.createdAt) === new Date().toLocaleDateString(`ar-JO`)).length} فاتورة`,
      `▤`,
    ],
    [`مبيعات الشهر`, money(monthSales), `صافي المبيعات`, `↗`],
    [`إجمالي الربح`, money(grossProfit), `قبل المصاريف`, `+`],
    [`صافي الربح`, money(grossProfit - monthExpenses), `بعد المصاريف`, `◎`],
    [`المشتريات`, money(monthPurchases), `هذا الشهر`, `⇣`],
    [`المصاريف`, money(monthExpenses), `هذا الشهر`, `−`],
    [`تنبيه مخزون`, low.length, `صنف منخفض`, `!`],
    [`إيجارات متأخرة`, overdue.length, `تحتاج متابعة`, `◷`],
  ];
  $(`#alert-strip`).innerHTML =
    low.length || overdue.length
      ? `<div class="alert-strip"><span>يوجد ${low.length} صنف منخفض و${overdue.length} إيجار متأخر.</span><button data-alerts>عرض التفاصيل</button></div>`
      : ``;
  $(`#page`).innerHTML =
    `<div class="stats-grid">${stats.map(([label, value, note, icon]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${note}</small></article>`).join(``)}</div><div class="split"><section class="panel"><div class="panel-head"><h2>اتجاه المبيعات — آخر 7 أيام</h2></div>${salesChart(completedSales)}</section><section class="panel"><div class="panel-head"><h2>تنبيهات المخزون</h2><button class="btn ghost small" data-products>كل المنتجات</button></div>${
      low.length
        ? low
            .slice(0, 6)
            .map(
              (item) =>
                `<div class="total-line"><span>${escapeHTML(item.name)}</span><span class="badge ${Number(item.stock) <= 0 ? `danger` : `warning`}">${item.stock || 0}</span></div>`,
            )
            .join(``)
        : `<div class="empty"><strong>المخزون مستقر</strong>لا توجد أصناف تحت الحد الأدنى.</div>`
    }</section></div>`;
  $(`[data-products]`)?.addEventListener(`click`, () => navigate(`products`));
  $(`[data-alerts]`)?.addEventListener(`click`, () =>
    navigate(low.length ? `products` : `rentals`),
  );
}
function salesChart(sales) {
  const days = [...Array(7)].map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return d;
  });
  const totals = days.map((day) =>
    sales
      .filter(
        (row) =>
          dateValue(row.createdAt)?.toDateString() === day.toDateString(),
      )
      .reduce((sum, row) => sum + Number(row.netTotal || 0), 0),
  );
  const max = Math.max(...totals, 1);
  return `<div class="chart-bars">${days.map((day, index) => `<div class="bar-group"><div class="bar" title="${money(totals[index])}" style="height:${Math.max(3, (totals[index] / max) * 100)}%"></div><small>${day.toLocaleDateString(`ar-JO`, { weekday: `short` })}</small></div>`).join(``)}</div>`;
}

async function renderPOS() {
  state.cart = [];
  const [products, services, customers] = await Promise.all([
    fetchRecent(`products`, 400),
    fetchRecent(`services`, 200),
    fetchRecent(`customers`, 200),
  ]);
  const sellables = [
    ...products
      .filter((x) => x.active !== false)
      .map((x) => ({
        ...x,
        type: `product`,
        price: Number(x.sellingPrice || 0),
      })),
    ...services
      .filter((x) => x.active !== false)
      .map((x) => ({
        ...x,
        type: `service`,
        price: Number(x.price || 0),
        stock: null,
      })),
  ];
  state.cache.pos = { sellables, customers };
  $(`#page`).innerHTML =
    `<div class="pos-layout"><section class="panel"><div class="panel-head"><h2>اختر مادة أو خدمة</h2></div><div class="toolbar"><input id="pos-search" placeholder="ابحث بالاسم أو الباركود…"><select id="pos-type"><option value="all">الكل</option><option value="product">منتجات</option><option value="service">خدمات</option></select></div><div id="product-grid" class="product-grid"></div></section><section class="panel cart"><div class="panel-head"><h2>الفاتورة الحالية</h2><button class="btn ghost small" id="clear-cart">مسح</button></div><div id="cart-list" class="cart-list"></div><label>الزبون<select id="pos-customer"><option value="">زبون نقدي</option>${customers.map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join(``)}</select></label><div class="form-grid"><label>طريقة الدفع<select id="pos-payment">${state.settings.paymentMethods.map((x) => `<option>${x}</option>`).join(``)}</select></label><label>الخصم<input id="pos-discount" type="number" min="0" step="0.01" value="0" ${can(state.user, `pos`, `discount`) ? `` : `disabled`}></label></div><label>ملاحظات<textarea id="pos-notes" rows="2"></textarea></label><div id="cart-totals" class="totals"></div><button id="save-sale" class="btn primary wide">حفظ وطباعة الفاتورة</button></section></div>`;
  const drawProducts = () => {
    const term = $(`#pos-search`).value.toLowerCase();
    const type = $(`#pos-type`).value;
    const rows = sellables
      .filter(
        (x) =>
          (x.name || ``).toLowerCase().includes(term) ||
          (x.sku || ``).toLowerCase().includes(term),
      )
      .filter((x) => type === `all` || x.type === type);
    $(`#product-grid`).innerHTML = rows.length
      ? rows
          .map(
            (item) =>
              `<button class="product-card" data-item="${item.id}" data-type="${item.type}"><small>${item.type === `product` ? escapeHTML(item.category) : `خدمة`}</small><strong>${escapeHTML(item.name)}</strong><b>${money(item.price)}</b><small>${item.type === `product` ? `المتوفر: ${item.stock || 0}` : `لا تخصم من المخزون`}</small></button>`,
          )
          .join(``)
      : `<div class="empty"><strong>لا توجد نتائج</strong>جرّب كلمة بحث أخرى.</div>`;
  };
  drawProducts();
  drawCart();
  $(`#pos-search`).oninput = drawProducts;
  $(`#pos-type`).onchange = drawProducts;
  $(`#product-grid`).onclick = (event) => {
    const button = event.target.closest(`[data-item]`);
    if (!button) return;
    const item = sellables.find(
      (x) => x.id === button.dataset.item && x.type === button.dataset.type,
    );
    addToCart(item);
  };
  $(`#cart-list`).onclick = (event) => {
    const button = event.target.closest(`[data-cart-action]`);
    if (!button) return;
    changeCart(button.dataset.key, button.dataset.cartAction);
  };
  $(`#cart-list`).oninput = (event) => {
    const input = event.target.closest(`[data-cart-price]`);
    if (input) updateCartPrice(input.dataset.key, input.value);
  };
  $(`#cart-list`).onchange = (event) => {
    const input = event.target.closest(`[data-cart-price]`);
    if (input) finishCartPrice(input.dataset.key, input.value);
  };
  $(`#clear-cart`).onclick = () => {
    state.cart = [];
    drawCart();
  };
  $(`#pos-discount`).oninput = drawCart;
  $(`#save-sale`).onclick = saveSale;
}
function cartKey(item) {
  return `${item.type}:${item.id}`;
}
function addToCart(item) {
  const key = cartKey(item);
  const found = state.cart.find((x) => x.key === key);
  if (
    item.type === `product` &&
    !state.settings.allowNegativeStock &&
    Number(item.stock || 0) <= Number(found?.quantity || 0)
  ) {
    toast(`الكمية غير متوفرة`, `error`);
    return;
  }
  if (found) found.quantity++;
  else
    state.cart.push({
      key,
      id: item.id,
      name: item.name,
      type: item.type,
      quantity: 1,
      price: item.price,
      originalPrice: item.price,
      cost: Number(item.costPrice || item.cost || 0),
      stock: item.stock,
    });
  drawCart();
}
function changeCart(key, action) {
  const item = state.cart.find((x) => x.key === key);
  if (!item) return;
  if (action === `plus`) {
    if (
      item.type === `product` &&
      !state.settings.allowNegativeStock &&
      item.quantity >= Number(item.stock || 0)
    ) {
      toast(`الكمية غير متوفرة`, `error`);
      return;
    }
    item.quantity++;
  }
  if (action === `minus`) item.quantity--;
  if (action === `reset-price`) item.price = item.originalPrice;
  if (action === `remove` || item.quantity <= 0)
    state.cart = state.cart.filter((x) => x.key !== key);
  drawCart();
}
function updateCartPrice(key, rawValue) {
  if (!can(state.user, `pos`, `discount`)) return;
  const item = state.cart.find((x) => x.key === key);
  const value = Number(rawValue);
  if (!item || rawValue === `` || !Number.isFinite(value) || value < 0) return;
  item.price = Math.round(value * 100) / 100;
  drawCartTotals();
}
function finishCartPrice(key, rawValue) {
  const item = state.cart.find((x) => x.key === key);
  const value = Number(rawValue);
  if (!item) return;
  if (
    !can(state.user, `pos`, `discount`) ||
    rawValue === `` ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    item.price = item.originalPrice;
    toast(`أدخل سعرا صحيحا`, `error`);
  } else item.price = Math.round(value * 100) / 100;
  drawCart();
}
function cartTotals() {
  const gross = state.cart.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
  const rawDiscount = Number($(`#pos-discount`)?.value || 0);
  const discount = Number.isFinite(rawDiscount)
    ? Math.min(gross, Math.max(0, rawDiscount))
    : 0;
  return {
    gross,
    discount,
    net: Math.max(0, gross - discount),
    cost: state.cart.reduce((sum, item) => sum + item.quantity * item.cost, 0),
  };
}
function drawCart() {
  const list = $(`#cart-list`);
  if (!list) return;
  list.innerHTML = state.cart.length
    ? state.cart
        .map((item) => {
          const adjusted = Number(item.price) !== Number(item.originalPrice);
          return `<div class="cart-row"><div class="cart-main"><strong>${escapeHTML(item.name)}</strong><small>${item.quantity} × ${money(item.price)} = ${money(item.quantity * item.price)}</small><label class="cart-price-field"><span>سعر الوحدة</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${item.price}" data-cart-price data-key="${item.key}" ${can(state.user, `pos`, `discount`) ? `` : `disabled`} aria-label="سعر وحدة ${escapeHTML(item.name)}"><span>د.أ</span></label>${adjusted ? `<div class="special-price"><span>سعر خاص لهذه الفاتورة فقط</span><button type="button" data-cart-action="reset-price" data-key="${item.key}">استعادة ${money(item.originalPrice)}</button></div>` : ``}</div><div class="qty"><button type="button" data-cart-action="plus" data-key="${item.key}" aria-label="زيادة الكمية">+</button><button type="button" data-cart-action="minus" data-key="${item.key}" aria-label="تقليل الكمية">−</button><button type="button" data-cart-action="remove" data-key="${item.key}" aria-label="حذف">×</button></div></div>`;
        })
        .join(``)
    : `<div class="empty"><strong>الفاتورة فارغة</strong>اختر منتجا أو خدمة للبدء.</div>`;
  drawCartTotals();
}
function drawCartTotals() {
  const totals = $(`#cart-totals`);
  if (!totals) return;
  const t = cartTotals();
  totals.innerHTML = `<div class="total-line"><span>${t.discount > 0 ? `الإجمالي قبل الخصم` : `الإجمالي`}</span><b>${money(t.gross)}</b></div>${t.discount > 0 ? `<div class="total-line"><span>الخصم</span><b>${money(t.discount)}</b></div>` : ``}<div class="total-line final"><span>${t.discount > 0 ? `الصافي` : `المطلوب`}</span><b>${money(t.net)}</b></div>`;
}
async function saveSale() {
  if (!state.cart.length) {
    toast(`أضف مادة واحدة على الأقل`, `error`);
    return;
  }
  const customerId = $(`#pos-customer`).value;
  const customer = state.cache.pos.customers.find((x) => x.id === customerId);
  const paymentMethod = $(`#pos-payment`).value;
  if (paymentMethod === `آجل` && !customerId) {
    toast(`اختر زبونا مسجلا قبل البيع الآجل`, `error`);
    $(`#pos-customer`).focus();
    return;
  }
  const totals = cartTotals();
  const discountInput = $(`#pos-discount`);
  const enteredDiscount = Number(discountInput.value || 0);
  if (!Number.isFinite(enteredDiscount) || enteredDiscount < 0) {
    discountInput.value = `0`;
    drawCartTotals();
    discountInput.focus();
    toast(`أدخل قيمة خصم صحيحة`, `error`);
    return;
  } else if (enteredDiscount > totals.gross) {
    discountInput.value = String(totals.gross);
    drawCartTotals();
    discountInput.focus();
    toast(`لا يمكن أن يتجاوز الخصم إجمالي الفاتورة`, `error`);
    return;
  }
  const finalTotals = cartTotals();
  const saleCart = state.cart.map((item) => ({ ...item }));
  const printWindow = window.open(``, `_blank`, `width=440,height=720`);
  const button = $(`#save-sale`);
  button.disabled = true;
  $(`#page`).classList.add(`is-saving`);
  try {
    const invoiceNo = `${state.settings.invoicePrefix || `INV`}-${Date.now().toString().slice(-9)}`;
    const priceAdjustments = saleCart
      .filter((item) => Number(item.price) !== Number(item.originalPrice))
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        originalPrice: item.originalPrice,
        unitPrice: item.price,
      }));
    const saleRef = doc(collection(db, `sales`));
    await runTransaction(db, async (transaction) => {
      for (const item of saleCart.filter((x) => x.type === `product`)) {
        const ref = doc(db, `products`, item.id);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error(`المنتج ${item.name} غير موجود`);
        const current = Number(snap.data().stock || 0);
        if (!state.settings.allowNegativeStock && current < item.quantity)
          throw new Error(`الكمية المتوفرة من ${item.name} هي ${current}`);
        transaction.update(ref, {
          stock: increment(-item.quantity),
          updatedAt: serverTimestamp(),
          updatedBy: state.user.id,
        });
      }
      transaction.set(saleRef, {
        invoiceNo,
        customerId: customerId || null,
        customerName: customer?.name || `زبون نقدي`,
        grossTotal: finalTotals.gross,
        discount: finalTotals.discount,
        netTotal: finalTotals.net,
        costTotal: finalTotals.cost,
        grossProfit: finalTotals.net - finalTotals.cost,
        hasPriceAdjustments: priceAdjustments.length > 0,
        paymentMethod,
        paidAmount: paymentMethod === `آجل` ? 0 : finalTotals.net,
        remainingAmount: paymentMethod === `آجل` ? finalTotals.net : 0,
        status: `مكتملة`,
        notes: $(`#pos-notes`).value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        operatorName: state.user.name,
        isDeleted: false,
      });
      if (paymentMethod === `آجل` && customerId)
        transaction.update(doc(db, `customers`, customerId), {
          balance: increment(finalTotals.net),
          updatedAt: serverTimestamp(),
          updatedBy: state.user.id,
        });
      if (paymentMethod !== `آجل`)
        transaction.set(doc(collection(db, `cashMovements`)), {
          type: `بيع`,
          amount: finalTotals.net,
          paymentMethod,
          referenceId: saleRef.id,
          referenceNo: invoiceNo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: state.user.id,
          isDeleted: false,
        });
      saleCart.forEach((item) => {
        const itemRef = doc(collection(db, `saleItems`));
        transaction.set(itemRef, {
          saleId: saleRef.id,
          invoiceNo,
          itemId: item.id,
          itemName: item.name,
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.price,
          baseUnitPrice: item.originalPrice,
          priceAdjusted: Number(item.price) !== Number(item.originalPrice),
          unitCost: item.cost,
          total: item.quantity * item.price,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: state.user.id,
          isDeleted: false,
        });
        if (item.type === `product`) {
          const movementRef = doc(collection(db, `stockMovements`));
          transaction.set(movementRef, {
            productId: item.id,
            productName: item.name,
            type: `بيع`,
            quantity: -item.quantity,
            referenceId: saleRef.id,
            referenceNo: invoiceNo,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: state.user.id,
            isDeleted: false,
          });
        }
      });
    });
    await audit(`create-invoice`, `pos`, null, {
      saleId: saleRef.id,
      invoiceNo,
      netTotal: finalTotals.net,
      priceAdjustments,
    });
    toast(`تم حفظ الفاتورة بنجاح`);
    printInvoice(
      {
        invoiceNo,
        customerName: customer?.name || `زبون نقدي`,
        ...finalTotals,
        items: saleCart,
        paymentMethod,
      },
      printWindow,
    );
    state.cart = [];
    await renderPOS();
  } catch (error) {
    if (printWindow && !printWindow.closed) printWindow.close();
    toast(readableError(error), `error`);
  } finally {
    button.disabled = false;
    $(`#page`).classList.remove(`is-saving`);
  }
}
function printInvoice(data, win) {
  if (!win || win.closed) {
    toast(`اسمح بالنوافذ المنبثقة لطباعة الفاتورة`, `error`);
    return;
  }
  try {
    win.document.open();
    win.document.write(
      `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${data.invoiceNo}</title><style>body{font-family:Arial;padding:16px;color:#2b1719}.invoice-logo{display:block;width:92px;height:92px;object-fit:cover;border-radius:22px;margin:0 auto 8px}.shop-name{color:#970E16;margin:4px 0}h2,p{text-align:center}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px dashed #d7bec0;text-align:right}.total{font-size:18px;font-weight:bold;color:#970E16}.meta{display:flex;justify-content:space-between;font-size:12px;border-block:1px solid #FCF0EC;padding:8px 0}@media print{button{display:none}}</style></head><body><img class="invoice-logo" src="${LOGO_URL}" alt="شعار الأصيل"><h2 class="shop-name">${escapeHTML(state.settings.shopName)}</h2><p>فاتورة مبيعات</p><div class="meta"><span>${data.invoiceNo}</span><span>${new Date().toLocaleString(`ar-JO`)}</span></div><p>الزبون: ${escapeHTML(data.customerName)}</p><table><thead><tr><th>المادة</th><th>ك</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${data.items.map((i) => `<tr><td>${escapeHTML(i.name)}</td><td>${i.quantity}</td><td>${money(i.price)}</td><td>${money(i.quantity * i.price)}</td></tr>`).join(``)}</tbody></table>${data.discount > 0 ? `<p>الإجمالي قبل الخصم: ${money(data.gross)}</p><p>الخصم: ${money(data.discount)}</p>` : ``}<p class="total">${data.discount > 0 ? `الصافي` : `الإجمالي`}: ${money(data.net)}</p><p>الدفع: ${escapeHTML(data.paymentMethod)}</p><button onclick="print()">طباعة</button><script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    win.document.close();
  } catch (error) {
    console.warn(`Invoice printing failed`, error);
    toast(`تم حفظ الفاتورة لكن تعذرت الطباعة`, `error`);
  }
}

async function renderPurchases() {
  const [purchases, products, suppliers] = await Promise.all([
    fetchRecent(`purchases`, 200),
    fetchRecent(`products`, 300),
    fetchRecent(`suppliers`, 200),
  ]);
  state.cache.purchases = { purchases, products, suppliers };
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>فواتير الشراء</h2><button class="btn primary" id="new-purchase">فاتورة شراء</button></div>${simpleTable(
      purchases,
      [
        [`invoiceNo`, `رقم الفاتورة`],
        [`supplierName`, `المورد`],
        [`purchaseDate`, `التاريخ`, `date`],
        [`totalCost`, `الإجمالي`, `money`],
        [`remainingAmount`, `المتبقي`, `money`],
      ],
    )}</section>`;
  $(`#new-purchase`).onclick = () => openPurchaseForm(products, suppliers);
}
function openPurchaseForm(products, suppliers) {
  if (!products.length) {
    toast(`أضف منتجا قبل تسجيل فاتورة شراء`, `error`);
    return;
  }
  if (!suppliers.length) {
    toast(`أضف موردا قبل تسجيل فاتورة شراء`, `error`);
    return;
  }
  $(`#dialog-title`).textContent = `فاتورة شراء جديدة`;
  $(`#dialog-body`).innerHTML =
    `<form id="purchase-form" class="form-grid"><label>المورد<select name="supplierId" required><option value="">اختر</option>${suppliers.map((x) => `<option value="${x.id}">${escapeHTML(x.name)}</option>`).join(``)}</select></label><label>تاريخ الشراء<input name="purchaseDate" type="date" value="${todayISO()}" required></label><label>المنتج<select name="productId" required><option value="">اختر</option>${products.map((x) => `<option value="${x.id}">${escapeHTML(x.name)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="1" step="1" required></label><label>تكلفة الوحدة<input name="unitCost" type="number" min="0" step="0.01" required></label><label>المبلغ المدفوع<input name="paidAmount" type="number" min="0" step="0.01" required></label><label>طريقة الدفع<select name="paymentMethod">${state.settings.paymentMethods.map((x) => `<option>${x}</option>`).join(``)}</select></label><label class="full">ملاحظات<textarea name="notes"></textarea></label></form>`;
  const dialog = $(`#entity-dialog`);
  showDialog(dialog);
  $(`#dialog-save`).onclick = async (event) => {
    event.preventDefault();
    const form = validForm(`#purchase-form`);
    if (!form) return;
    const data = Object.fromEntries(new FormData(form));
    const product = products.find((x) => x.id === data.productId);
    const supplier = suppliers.find((x) => x.id === data.supplierId);
    data.quantity = Number(data.quantity);
    data.unitCost = Number(data.unitCost);
    data.paidAmount = Number(data.paidAmount);
    data.totalCost = data.quantity * data.unitCost;
    if (data.paidAmount > data.totalCost) {
      toast(`المبلغ المدفوع لا يمكن أن يتجاوز إجمالي فاتورة الشراء`, `error`);
      form.elements.paidAmount.focus();
      return;
    }
    data.remainingAmount = Math.max(0, data.totalCost - data.paidAmount);
    data.invoiceNo = `PUR-${Date.now().toString().slice(-9)}`;
    const saveButton = $(`#dialog-save`);
    saveButton.disabled = true;
    try {
      const ref = doc(collection(db, `purchases`));
      const batch = writeBatch(db);
      batch.set(ref, {
        ...data,
        productName: product.name,
        supplierName: supplier.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        isDeleted: false,
      });
      batch.update(doc(db, `products`, product.id), {
        stock: increment(data.quantity),
        costPrice: data.unitCost,
        updatedAt: serverTimestamp(),
        updatedBy: state.user.id,
      });
      batch.update(doc(db, `suppliers`, supplier.id), {
        balance: increment(data.remainingAmount),
        updatedAt: serverTimestamp(),
        updatedBy: state.user.id,
      });
      batch.set(doc(collection(db, `purchaseItems`)), {
        purchaseId: ref.id,
        productId: product.id,
        productName: product.name,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost: data.totalCost,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        isDeleted: false,
      });
      batch.set(doc(collection(db, `stockMovements`)), {
        productId: product.id,
        productName: product.name,
        type: `شراء`,
        quantity: data.quantity,
        referenceId: ref.id,
        referenceNo: data.invoiceNo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        isDeleted: false,
      });
      if (data.paidAmount > 0)
        batch.set(doc(collection(db, `cashMovements`)), {
          type: `شراء`,
          amount: -data.paidAmount,
          paymentMethod: data.paymentMethod,
          referenceId: ref.id,
          referenceNo: data.invoiceNo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: state.user.id,
          isDeleted: false,
        });
      await batch.commit();
      await audit(`create`, `purchases`, null, data);
      dialog.close();
      toast(`تم حفظ المشتريات وتحديث المخزون`);
      navigate(`purchases`);
    } catch (error) {
      toast(readableError(error), `error`);
    } finally {
      saveButton.disabled = false;
    }
  };
}

async function renderRentals() {
  const [rentals, products, customers] = await Promise.all([
    fetchRecent(`rentals`, 200),
    fetchRecent(`products`, 300),
    fetchRecent(`customers`, 200),
  ]);
  state.cache.rentals = { rentals, products, customers };
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>حركات التأجير</h2><button class="btn primary" id="new-rental">تأجير مادة</button></div>${simpleTable(
      rentals,
      [
        [`itemName`, `المادة`],
        [`customerName`, `الزبون`],
        [`quantity`, `الكمية`],
        [`rentalDate`, `تاريخ التأجير`, `date`],
        [`expectedReturnDate`, `الإرجاع المتوقع`, `date`],
        [`status`, `الحالة`, `status`],
      ],
      true,
    )}</section>`;
  $(`#new-rental`).onclick = () =>
    openRentalForm(
      products.filter((x) => x.rentable && x.active !== false),
      customers,
    );
  $(`#page`).onclick = (event) => {
    const button = event.target.closest(`[data-return-rental]`);
    if (button)
      returnRental(rentals.find((x) => x.id === button.dataset.returnRental));
  };
}
function openRentalForm(products, customers) {
  if (!products.length) {
    toast(`عرّف منتجا قابلا للتأجير أولا`, `error`);
    return;
  }
  if (!customers.length) {
    toast(`أضف زبونا قبل تسجيل عملية تأجير`, `error`);
    return;
  }
  $(`#dialog-title`).textContent = `تأجير مادة`;
  $(`#dialog-body`).innerHTML =
    `<form id="rental-form" class="form-grid"><label>المادة<select name="itemId" required>${products.map((x) => `<option value="${x.id}">${escapeHTML(x.name)} — متوفر ${x.stock || 0}</option>`).join(``)}</select></label><label>الزبون<select name="customerId" required>${customers.map((x) => `<option value="${x.id}">${escapeHTML(x.name)}</option>`).join(``)}</select></label><label>الكمية<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>تاريخ التأجير<input name="rentalDate" type="date" value="${todayISO()}" required></label><label>الإرجاع المتوقع<input name="expectedReturnDate" type="date" value="${todayISO()}" required></label><label>سعر التأجير<input name="rentalPrice" type="number" min="0" step="0.01" required></label><label>التأمين<input name="deposit" type="number" min="0" step="0.01" value="0"></label><label class="full">ملاحظات<textarea name="notes"></textarea></label></form>`;
  const dialog = $(`#entity-dialog`);
  showDialog(dialog);
  $(`#dialog-save`).onclick = async (event) => {
    event.preventDefault();
    const form = validForm(`#rental-form`);
    if (!form) return;
    const data = Object.fromEntries(new FormData(form));
    const item = products.find((x) => x.id === data.itemId);
    const customer = customers.find((x) => x.id === data.customerId);
    data.quantity = Number(data.quantity);
    data.rentalPrice = Number(data.rentalPrice);
    data.deposit = Number(data.deposit);
    if (data.expectedReturnDate < data.rentalDate) {
      toast(`تاريخ الإرجاع يجب أن يساوي تاريخ التأجير أو يأتي بعده`, `error`);
      form.elements.expectedReturnDate.focus();
      return;
    }
    if (
      !state.settings.allowNegativeStock &&
      Number(item.stock) < data.quantity
    ) {
      toast(`الكمية غير متوفرة`, `error`);
      return;
    }
    const saveButton = $(`#dialog-save`);
    saveButton.disabled = true;
    try {
      const ref = doc(collection(db, `rentals`));
      const batch = writeBatch(db);
      batch.set(ref, {
        ...data,
        itemName: item.name,
        customerName: customer.name,
        status: `نشط`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        isDeleted: false,
      });
      batch.update(doc(db, `products`, item.id), {
        stock: increment(-data.quantity),
        updatedAt: serverTimestamp(),
        updatedBy: state.user.id,
      });
      batch.set(doc(collection(db, `stockMovements`)), {
        productId: item.id,
        productName: item.name,
        type: `تأجير`,
        quantity: -data.quantity,
        referenceId: ref.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        isDeleted: false,
      });
      await batch.commit();
      await audit(`rental-out`, `rentals`, null, data);
      dialog.close();
      toast(`تم تسجيل التأجير`);
      navigate(`rentals`);
    } catch (error) {
      toast(readableError(error), `error`);
    } finally {
      saveButton.disabled = false;
    }
  };
}
async function returnRental(row) {
  if (!row || row.status !== `نشط`) return;
  const ok = await confirmAction(
    `إرجاع مادة التأجير`,
    `سيتم إرجاع الكمية إلى المخزون وإغلاق الحركة.`,
  );
  if (!ok) return;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `rentals`, row.id), {
      status: `مرجع`,
      actualReturnDate: todayISO(),
      updatedAt: serverTimestamp(),
      updatedBy: state.user.id,
    });
    batch.update(doc(db, `products`, row.itemId), {
      stock: increment(Number(row.quantity)),
      updatedAt: serverTimestamp(),
      updatedBy: state.user.id,
    });
    batch.set(doc(collection(db, `stockMovements`)), {
      productId: row.itemId,
      productName: row.itemName,
      type: `إرجاع تأجير`,
      quantity: Number(row.quantity),
      referenceId: row.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: state.user.id,
      isDeleted: false,
    });
    await batch.commit();
    await audit(`rental-return`, `rentals`, row, { status: `مرجع` });
    toast(`تم إرجاع مادة الإيجار`);
    navigate(`rentals`);
  } catch (error) {
    toast(readableError(error), `error`);
  }
}

function simpleTable(rows, columns, rentalActions = false) {
  if (!rows.length)
    return `<div class="empty"><strong>لا توجد بيانات</strong>لم تسجل أي حركة بعد.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(([, label]) => `<th>${label}</th>`).join(``)}${rentalActions ? `<th>الإجراء</th>` : ``}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key, , type]) => `<td>${type === `status` ? `<span class="badge ${row[key] === `نشط` ? `warning` : `success`}">${escapeHTML(row[key])}</span>` : valueCell(row[key], type)}</td>`).join(``)}${rentalActions ? `<td>${row.status === `نشط` ? `<button class="btn primary small" data-return-rental="${row.id}">تسجيل الإرجاع</button>` : `—`}</td>` : ``}</tr>`).join(``)}</tbody></table></div>`;
}
async function renderInvoices() {
  const rows = await fetchRecent(`sales`, 300);
  state.cache.invoices = rows;
  state.cache.invoiceDetails = {};
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>فواتير المبيعات</h2><div class="panel-actions"><button class="btn ghost" id="invoice-export">تصدير CSV</button></div></div>${invoiceTable(rows)}</section>`;
  $(`#invoice-export`).onclick = () =>
    exportCSV(
      rows,
      [
        [`invoiceNo`, `رقم الفاتورة`],
        [`customerName`, `الزبون`],
        [`operatorName`, `المستخدم`],
        [`paymentMethod`, `الدفع`],
        [`netTotal`, `الصافي`],
        [`status`, `الحالة`],
      ],
      `فواتير المبيعات`,
    );
  $(`#page`).onclick = (event) => {
    const viewButton = event.target.closest(`[data-view-invoice]`);
    const pdfButton = event.target.closest(`[data-pdf-invoice]`);
    const voidButton = event.target.closest(`[data-void]`);
    if (viewButton)
      openInvoicePreview(
        rows.find((x) => x.id === viewButton.dataset.viewInvoice),
      );
    if (pdfButton)
      downloadInvoiceByRow(
        rows.find((x) => x.id === pdfButton.dataset.pdfInvoice),
        pdfButton,
      );
    if (voidButton)
      voidInvoice(rows.find((x) => x.id === voidButton.dataset.void));
  };
}
function invoiceTable(rows) {
  if (!rows.length)
    return `<div class="empty"><strong>لا توجد فواتير</strong>ابدأ من نقطة البيع.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>الفاتورة</th><th>التاريخ</th><th>الزبون</th><th>الدفع</th><th>الصافي</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.invoiceNo)}</td><td>${dateText(row.createdAt)}</td><td>${escapeHTML(row.customerName)}</td><td>${escapeHTML(row.paymentMethod)}</td><td>${money(row.netTotal)}</td><td><span class="badge ${row.status === `ملغاة` ? `danger` : `success`}">${escapeHTML(row.status)}</span></td><td><div class="invoice-actions"><button class="btn ghost small invoice-eye" type="button" data-view-invoice="${row.id}" title="مشاهدة الفاتورة" aria-label="مشاهدة الفاتورة">👁</button>${can(state.user, `invoices`, `print`) ? `<button class="btn ghost small pdf-button" type="button" data-pdf-invoice="${row.id}" title="تنزيل PDF">PDF</button>` : ``}${row.status !== `ملغاة` && can(state.user, `invoices`, `void`) ? `<button class="btn danger small" type="button" data-void="${row.id}">إلغاء</button>` : ``}</div></td></tr>`).join(``)}</tbody></table></div>`;
}
async function loadInvoiceData(row) {
  if (!row) throw new Error(`الفاتورة غير موجودة`);
  if (state.cache.invoiceDetails?.[row.id])
    return state.cache.invoiceDetails[row.id];
  const itemsSnap = await getDocs(
    query(collection(db, `saleItems`), where(`saleId`, `==`, row.id)),
  );
  const items = itemsSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => !item.isDeleted)
    .map((item) => ({
      ...item,
      name: item.itemName,
      price: Number(item.unitPrice || 0),
      quantity: Number(item.quantity || 0),
    }));
  const data = {
    ...row,
    gross: Number(
      row.grossTotal ??
        items.reduce((sum, item) => sum + item.quantity * item.price, 0),
    ),
    discount: Number(row.discount || 0),
    net: Number(row.netTotal || 0),
    items,
  };
  state.cache.invoiceDetails[row.id] = data;
  return data;
}
function invoiceMoment(value) {
  const date = dateValue(value) || new Date();
  return Number.isNaN(date.valueOf()) ? `—` : date.toLocaleString(`ar-JO`);
}
function invoiceDocumentHTML(data) {
  return `<article class="invoice-document" dir="rtl"><header class="invoice-brand"><img crossorigin="anonymous" src="${LOGO_URL}" alt="شعار الأصيل"><div><p>الأصيل للإطارات والزيوت المعدنية</p><h2>${escapeHTML(state.settings.shopName)}</h2><span>فاتورة مبيعات</span></div></header><div class="invoice-meta"><div><small>رقم الفاتورة</small><strong>${escapeHTML(data.invoiceNo)}</strong></div><div><small>التاريخ والوقت</small><strong>${invoiceMoment(data.createdAt)}</strong></div><div><small>الزبون</small><strong>${escapeHTML(data.customerName || `زبون نقدي`)}</strong></div><div><small>طريقة الدفع</small><strong>${escapeHTML(data.paymentMethod || `—`)}</strong></div></div>${data.status === `ملغاة` ? `<div class="invoice-cancelled">فاتورة ملغاة</div>` : ``}<div class="invoice-items"><table><thead><tr><th>المادة أو الخدمة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${data.items.map((item) => `<tr><td>${escapeHTML(item.name)}</td><td>${item.quantity}</td><td>${money(item.price)}</td><td>${money(item.quantity * item.price)}</td></tr>`).join(``)}</tbody></table></div><div class="invoice-summary"><div><span>${data.discount > 0 ? `الإجمالي قبل الخصم` : `الإجمالي`}</span><strong>${money(data.gross)}</strong></div>${data.discount > 0 ? `<div class="discount"><span>الخصم</span><strong>− ${money(data.discount)}</strong></div>` : ``}<div class="grand-total"><span>${data.discount > 0 ? `الصافي` : `المبلغ المطلوب`}</span><strong>${money(data.net)}</strong></div></div>${data.notes ? `<div class="invoice-notes"><strong>ملاحظات</strong><p>${escapeHTML(data.notes)}</p></div>` : ``}<footer><span>شكرًا لاختياركم الأصيل</span><small>خدمتكم وثقتكم مسؤوليتنا</small></footer></article>`;
}
async function openInvoicePreview(row) {
  const dialog = $(`#entity-dialog`);
  const saveButton = $(`#dialog-save`);
  const closeButton = dialog.querySelector(`footer [data-close-dialog]`);
  $(`#dialog-title`).textContent = `معاينة الفاتورة ${row?.invoiceNo || ``}`;
  $(`#dialog-body`).innerHTML =
    `<div class="empty"><div class="spinner"></div><strong>جاري تحميل الفاتورة</strong></div>`;
  saveButton.classList.add(`hidden`);
  closeButton.textContent = `إغلاق`;
  showDialog(dialog);
  const resetDialog = () => {
    saveButton.textContent = `حفظ`;
    saveButton.classList.remove(`hidden`);
    saveButton.disabled = false;
    closeButton.textContent = `إلغاء`;
  };
  dialog.addEventListener(`close`, resetDialog, { once: true });
  try {
    const data = await loadInvoiceData(row);
    if (!dialog.open) return;
    $(`#dialog-body`).innerHTML = invoiceDocumentHTML(data);
    saveButton.textContent = `تنزيل PDF`;
    saveButton.classList.remove(`hidden`);
    saveButton.onclick = () => downloadInvoicePDF(data, saveButton);
  } catch (error) {
    $(`#dialog-body`).innerHTML =
      `<div class="empty"><strong>تعذر تحميل الفاتورة</strong>${escapeHTML(readableError(error))}</div>`;
  }
}
async function downloadInvoiceByRow(row, button) {
  try {
    const data = await loadInvoiceData(row);
    await downloadInvoicePDF(data, button);
  } catch (error) {
    toast(readableError(error), `error`);
  }
}
function loadPDFLibrary(name, source, ready) {
  if (ready()) return Promise.resolve();
  const existing = document.querySelector(`script[data-pdf-library="${name}"]`);
  if (existing) existing.remove();
  return new Promise((resolve, reject) => {
    const script = document.createElement(`script`);
    script.src = source;
    script.dataset.pdfLibrary = name;
    script.onload = () =>
      ready() ? resolve() : reject(new Error(`تعذر تشغيل أداة PDF`));
    script.onerror = () => reject(new Error(`تعذر تحميل أداة PDF`));
    document.head.append(script);
  });
}
async function ensurePDFLibraries() {
  await loadPDFLibrary(
    `html2canvas`,
    `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js`,
    () => typeof window.html2canvas === `function`,
  );
  await loadPDFLibrary(
    `jspdf`,
    `https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js`,
    () => Boolean(window.jspdf?.jsPDF),
  );
}
async function waitForInvoiceImages(element) {
  await Promise.all(
    [...element.querySelectorAll(`img`)].map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) resolve();
          else {
            image.onload = resolve;
            image.onerror = resolve;
          }
        }),
    ),
  );
}
async function downloadInvoicePDF(data, button = null) {
  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = `جاري إنشاء PDF…`;
  }
  const capture = document.createElement(`div`);
  capture.className = `pdf-capture`;
  capture.innerHTML = invoiceDocumentHTML(data);
  document.body.append(capture);
  try {
    await ensurePDFLibraries();
    if (document.fonts) await document.fonts.ready;
    await waitForInvoiceImages(capture);
    const canvas = await window.html2canvas(
      capture.querySelector(`.invoice-document`),
      {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: `#ffffff`,
      },
    );
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: `portrait`,
      unit: `mm`,
      format: `a4`,
      compress: true,
    });
    const margin = 10;
    const contentWidth = 190;
    const pageHeight = 277;
    const sliceHeight = Math.floor((canvas.width * pageHeight) / contentWidth);
    let offset = 0;
    let page = 0;
    while (offset < canvas.height) {
      const height = Math.min(sliceHeight, canvas.height - offset);
      const pageCanvas = document.createElement(`canvas`);
      pageCanvas.width = canvas.width;
      pageCanvas.height = height;
      pageCanvas
        .getContext(`2d`)
        .drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          height,
          0,
          0,
          canvas.width,
          height,
        );
      if (page > 0) pdf.addPage();
      const renderedHeight = (height * contentWidth) / canvas.width;
      pdf.addImage(
        pageCanvas.toDataURL(`image/jpeg`, 0.94),
        `JPEG`,
        margin,
        margin,
        contentWidth,
        renderedHeight,
        undefined,
        `FAST`,
      );
      offset += height;
      page += 1;
    }
    pdf.save(`${data.invoiceNo || `invoice`}.pdf`);
    toast(`تم تنزيل الفاتورة PDF`);
  } catch (error) {
    console.error(`PDF generation failed`, error);
    toast(`تعذر إنشاء PDF. تحقق من الإنترنت ثم أعد المحاولة`, `error`);
  } finally {
    capture.remove();
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}
async function voidInvoice(row) {
  const ok = await confirmAction(
    `إلغاء الفاتورة ${row.invoiceNo}`,
    `سيتم عكس كميات المنتجات وإلغاء أثر المبلغ. لا يمكن التراجع عن هذه العملية.`,
  );
  if (!ok) return;
  try {
    const itemsSnap = await getDocs(
      query(collection(db, `saleItems`), where(`saleId`, `==`, row.id)),
    );
    const items = itemsSnap.docs.map((x) => x.data());
    const batch = writeBatch(db);
    batch.update(doc(db, `sales`, row.id), {
      status: `ملغاة`,
      voidReason: `إلغاء بواسطة المدير`,
      voidedAt: serverTimestamp(),
      voidedBy: state.user.id,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.id,
    });
    items
      .filter((x) => x.type === `product`)
      .forEach((item) => {
        batch.update(doc(db, `products`, item.itemId), {
          stock: increment(Number(item.quantity)),
          updatedAt: serverTimestamp(),
          updatedBy: state.user.id,
        });
        batch.set(doc(collection(db, `stockMovements`)), {
          productId: item.itemId,
          productName: item.itemName,
          type: `إلغاء بيع`,
          quantity: Number(item.quantity),
          referenceId: row.id,
          referenceNo: row.invoiceNo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: state.user.id,
          isDeleted: false,
        });
      });
    if (row.paymentMethod === `آجل` && row.customerId)
      batch.update(doc(db, `customers`, row.customerId), {
        balance: increment(-Number(row.remainingAmount || 0)),
        updatedAt: serverTimestamp(),
        updatedBy: state.user.id,
      });
    else
      batch.set(doc(collection(db, `cashMovements`)), {
        type: `إلغاء بيع`,
        amount: -Number(row.paidAmount || row.netTotal || 0),
        paymentMethod: row.paymentMethod,
        referenceId: row.id,
        referenceNo: row.invoiceNo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: state.user.id,
        isDeleted: false,
      });
    await batch.commit();
    await audit(`void-invoice`, `invoices`, row, { status: `ملغاة` });
    toast(`تم إلغاء الفاتورة وعكس المخزون`);
    navigate(`invoices`);
  } catch (error) {
    toast(readableError(error), `error`);
  }
}
async function renderReports() {
  const [sales, expenses, purchases] = await Promise.all([
    fetchRecent(`sales`, 500),
    fetchRecent(`expenses`, 500),
    fetchRecent(`purchases`, 500),
  ]);
  const completedSales = sales.filter((row) => row.status !== `ملغاة`);
  const recalc = () => {
    const from = new Date(`${$(`#report-from`).value}T00:00:00`);
    const to = new Date(`${$(`#report-to`).value}T23:59:59`);
    if (from > to) {
      state.reportRows = [];
      $(`#report-output`).innerHTML =
        `<section class="panel empty"><strong>الفترة غير صحيحة</strong>تاريخ البداية يجب أن يسبق تاريخ النهاية.</section>`;
      return;
    }
    const inside = (row) => {
      const d = dateValue(row.date || row.purchaseDate || row.createdAt);
      return d >= from && d <= to;
    };
    const filteredSales = completedSales.filter(inside);
    const filteredExpenses = expenses.filter(inside);
    const filteredPurchases = purchases.filter(inside);
    const netSales = filteredSales.reduce(
      (s, x) => s + Number(x.netTotal || 0),
      0,
    );
    const grossProfit = filteredSales.reduce(
      (s, x) => s + Number(x.grossProfit || 0),
      0,
    );
    const expenseTotal = filteredExpenses.reduce(
      (s, x) => s + Number(x.amount || 0),
      0,
    );
    const purchaseTotal = filteredPurchases.reduce(
      (s, x) => s + Number(x.totalCost || 0),
      0,
    );
    state.reportRows = filteredSales;
    $(`#report-output`).innerHTML =
      `<div class="stats-grid"><article class="stat-card"><div class="stat-top">صافي المبيعات</div><strong>${money(netSales)}</strong></article><article class="stat-card"><div class="stat-top">إجمالي الربح</div><strong>${money(grossProfit)}</strong></article><article class="stat-card"><div class="stat-top">المصاريف</div><strong>${money(expenseTotal)}</strong></article><article class="stat-card"><div class="stat-top">صافي الربح</div><strong class="${grossProfit - expenseTotal >= 0 ? `kpi-positive` : `kpi-negative`}">${money(grossProfit - expenseTotal)}</strong></article><article class="stat-card"><div class="stat-top">المشتريات</div><strong>${money(purchaseTotal)}</strong></article><article class="stat-card"><div class="stat-top">عدد الفواتير</div><strong>${filteredSales.length}</strong></article></div><section class="panel"><div class="panel-head"><h2>تفاصيل المبيعات</h2></div>${simpleTable(
        filteredSales,
        [
          [`invoiceNo`, `الفاتورة`],
          [`createdAt`, `التاريخ`, `date`],
          [`customerName`, `الزبون`],
          [`paymentMethod`, `الدفع`],
          [`netTotal`, `الصافي`, `money`],
          [`grossProfit`, `الربح`, `money`],
        ],
      )}</section>`;
  };
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>فلاتر التقرير</h2><div class="panel-actions"><button class="btn ghost" id="print-report">طباعة</button><button class="btn primary" id="export-report">تصدير CSV</button></div></div><div class="filters"><label>من<input id="report-from" type="date" value="${monthStart()}"></label><label>إلى<input id="report-to" type="date" value="${todayISO()}"></label></div></section><div id="report-output"></div>`;
  $(`#report-from`).onchange = recalc;
  $(`#report-to`).onchange = recalc;
  $(`#print-report`).onclick = () => window.print();
  $(`#export-report`).onclick = () =>
    exportCSV(
      state.reportRows,
      [
        [`invoiceNo`, `الفاتورة`],
        [`customerName`, `الزبون`],
        [`operatorName`, `المستخدم`],
        [`paymentMethod`, `الدفع`],
        [`netTotal`, `الصافي`],
        [`grossProfit`, `الربح`],
      ],
      `تقرير المبيعات`,
    );
  recalc();
}

async function renderUsers() {
  const rows = await fetchRecent(`users`, 100);
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><div><h2>المستخدمون</h2><p class="muted section-note">أنشئ الحساب وحدد صلاحياته مباشرة من هنا.</p></div>${state.user.role === `admin` ? `<button class="btn primary" data-user-add>إضافة مستخدم</button>` : ``}</div>${userTable(rows)}</section>`;
  $(`#page`).onclick = (event) => {
    const add = event.target.closest(`[data-user-add]`);
    const edit = event.target.closest(`[data-user-edit]`);
    if (add && state.user.role === `admin`) openUserPermissions();
    if (edit)
      openUserPermissions(rows.find((x) => x.id === edit.dataset.userEdit));
  };
}
function userTable(rows) {
  if (!rows.length)
    return `<div class="empty"><strong>لا يوجد مستخدمون</strong></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHTML(row.name)}</td><td>${escapeHTML(row.email)}</td><td>${row.role === `admin` ? `مدير` : `مشغل`}</td><td>${valueCell(row.active, `bool`)}</td><td><button class="btn ghost small" data-user-edit="${row.id}">الصلاحيات</button></td></tr>`).join(``)}</tbody></table></div>`;
}
function openUserPermissions(user = null) {
  const isNew = !user;
  const current = user || {
    name: ``,
    email: ``,
    role: `operator`,
    active: true,
    permissions: DEFAULT_OPERATOR_PERMISSIONS,
  };
  const modules = NAV.map(([key, , label]) => [key, label]);
  const actions = [
    [`view`, `عرض`],
    [`create`, `إضافة`],
    [`discount`, `خصم/سعر`],
    [`edit`, `تعديل`],
    [`delete`, `حذف`],
    [`export`, `تصدير`],
    [`print`, `طباعة`],
    [`void`, `إلغاء`],
  ];
  $(`#dialog-title`).textContent = isNew
    ? `إضافة مستخدم جديد`
    : `صلاحيات ${current.name}`;
  $(`#dialog-body`).innerHTML =
    `<form id="user-form" class="form-grid"><label>الاسم<input name="name" value="${escapeHTML(current.name)}" required maxlength="80"></label><label>البريد الإلكتروني<input name="email" type="email" value="${escapeHTML(current.email)}" ${isNew ? `` : `readonly`} required></label>${isNew ? `<label>كلمة المرور المؤقتة<input name="password" type="password" minlength="6" autocomplete="new-password" required></label>` : ``}<label>الدور<select name="role"><option value="operator" ${current.role === `operator` ? `selected` : ``}>مشغل</option><option value="admin" ${current.role === `admin` ? `selected` : ``}>مدير</option></select></label><label>الحالة<select name="active"><option value="true" ${current.active !== false ? `selected` : ``}>نشط</option><option value="false" ${current.active === false ? `selected` : ``}>موقوف</option></select></label><div class="full permission-grid"><div class="permission-row"><strong>الوحدة</strong>${actions.map(([, label]) => `<strong>${label}</strong>`).join(``)}</div>${modules.map(([module, label]) => `<div class="permission-row"><strong>${label}</strong>${actions.map(([action]) => `<label title="${label} - ${action}"><input type="checkbox" name="perm:${module}:${action}" ${current.permissions?.[module]?.includes(action) || current.role === `admin` ? `checked` : ``}></label>`).join(``)}</div>`).join(``)}</div></form>`;
  const dialog = $(`#entity-dialog`);
  showDialog(dialog);
  $(`#dialog-save`).onclick = async (event) => {
    event.preventDefault();
    const saveButton = $(`#dialog-save`);
    const form = validForm(`#user-form`);
    if (!form) return;
    const fd = new FormData(form);
    const permissions = {};
    modules.forEach(([module]) => {
      permissions[module] = actions
        .filter(([action]) => fd.has(`perm:${module}:${action}`))
        .map(([action]) => action);
      if (!permissions[module].length) delete permissions[module];
    });
    const payload = {
      name: fd.get(`name`).trim(),
      role: fd.get(`role`),
      active: fd.get(`active`) === `true`,
      permissions:
        fd.get(`role`) === `admin` ? DEFAULT_ADMIN_PERMISSIONS : permissions,
      updatedAt: serverTimestamp(),
      updatedBy: state.user.id,
    };
    if (
      !isNew &&
      current.id === state.user.id &&
      (payload.active === false || payload.role !== `admin`)
    ) {
      toast(`لا يمكنك إيقاف حسابك الحالي أو إزالة صلاحية المدير منه`, `error`);
      return;
    }
    saveButton.disabled = true;
    try {
      if (isNew) {
        const email = fd.get(`email`).trim().toLowerCase();
        const uid = await createManagedUser({
          ...payload,
          email,
          password: fd.get(`password`),
          createdBy: state.user.id,
        });
        await audit(`create-user`, `users`, null, {
          uid,
          name: payload.name,
          email,
          role: payload.role,
          permissions: payload.permissions,
        });
        toast(`تم إنشاء المستخدم ويمكنه تسجيل الدخول الآن`);
      } else {
        await updateDoc(doc(db, `users`, current.id), payload);
        await audit(`change-permissions`, `users`, current, payload);
        toast(`تم تحديث الصلاحيات`);
      }
      dialog.close();
      navigate(`users`);
    } catch (error) {
      toast(readableError(error), `error`);
    } finally {
      saveButton.disabled = false;
    }
  };
}
async function renderSettings() {
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>الإعدادات العامة</h2></div><form id="settings-form" class="form-grid"><label>اسم المحل<input name="shopName" value="${escapeHTML(state.settings.shopName || ``)}" required></label><label>بادئة الفاتورة<input name="invoicePrefix" value="${escapeHTML(state.settings.invoicePrefix || `INV`)}" required></label><label>حد تنبيه المخزون<input name="lowStockThreshold" type="number" min="0" value="${state.settings.lowStockThreshold || 5}"></label><label>السماح بالمخزون السالب<select name="allowNegativeStock"><option value="false" ${!state.settings.allowNegativeStock ? `selected` : ``}>لا</option><option value="true" ${state.settings.allowNegativeStock ? `selected` : ``}>نعم</option></select></label><label>رسوم تأخير الإيجار اليومية<input name="rentalLateFee" type="number" min="0" step="0.01" value="${state.settings.rentalLateFee || 0}"></label><label class="full">طرق الدفع مفصولة بفاصلة<input name="paymentMethods" value="${escapeHTML(state.settings.paymentMethods.join(`، `))}"></label><div class="full"><button class="btn primary" type="submit">حفظ الإعدادات</button></div></form></section>`;
  $(`#settings-form`).onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.allowNegativeStock = data.allowNegativeStock === `true`;
    data.lowStockThreshold = Number(data.lowStockThreshold);
    data.rentalLateFee = Number(data.rentalLateFee);
    data.paymentMethods = data.paymentMethods
      .split(/[،,]/)
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      await setDoc(
        doc(db, `settings`, `general`),
        {
          ...state.settings,
          ...data,
          updatedAt: serverTimestamp(),
          updatedBy: state.user.id,
        },
        { merge: true },
      );
      state.settings = { ...state.settings, ...data };
      await audit(`edit`, `settings`, null, data);
      $(`#brand-shop`).textContent = data.shopName;
      toast(`تم حفظ الإعدادات`);
    } catch (error) {
      toast(readableError(error), `error`);
    }
  };
}
async function renderAudit() {
  const rows = await fetchRecent(`auditLogs`, 300);
  $(`#page`).innerHTML =
    `<section class="panel"><div class="panel-head"><h2>سجل التدقيق</h2><button class="btn ghost" id="audit-export">تصدير CSV</button></div>${simpleTable(
      rows,
      [
        [`createdAt`, `التاريخ`, `date`],
        [`userName`, `المستخدم`],
        [`module`, `الوحدة`],
        [`action`, `الإجراء`],
        [`device`, `الجهاز`],
      ],
    )}</section>`;
  $(`#audit-export`).onclick = () =>
    exportCSV(
      rows,
      [
        [`createdAt`, `التاريخ`],
        [`userName`, `المستخدم`],
        [`module`, `الوحدة`],
        [`action`, `الإجراء`],
        [`device`, `الجهاز`],
      ],
      `سجل التدقيق`,
    );
}
function exportCSV(rows, columns, name) {
  if (!rows.length) {
    toast(`لا توجد بيانات للتصدير`, `error`);
    return;
  }
  const cell = (value) => `"${String(value ?? ``).replaceAll(`"`, `""`)}"`;
  const csv = `\uFEFF${columns.map(([, label]) => cell(label)).join(`,`)}\n${rows.map((row) => columns.map(([key]) => cell(row[key]?.toDate ? row[key].toDate().toISOString() : row[key])).join(`,`)).join(`\n`)}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: `text/csv;charset=utf-8` }),
  );
  const a = document.createElement(`a`);
  a.href = url;
  a.download = `${name}-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function showAuth() {
  state.user = null;
  $(`#app`).classList.add(`hidden`);
  $(`#auth-view`).classList.remove(`hidden`);
  $(`#boot`).classList.add(`hidden`);
  try {
    const setup = !(await isInitialized());
    $(`#setup-fields`).classList.toggle(`hidden`, !setup);
    $(`#auth-title`).textContent = setup
      ? `تهيئة المحل لأول مرة`
      : `تسجيل الدخول`;
    $(`#auth-subtitle`).textContent = setup
      ? `أنشئ حساب المدير الرئيسي وبيانات المحل`
      : `أدخل بيانات حسابك للمتابعة`;
    $(`#auth-submit`).textContent = setup
      ? `إنشاء المدير وتشغيل النظام`
      : `دخول`;
    $(`#auth-name`).required = setup;
    $(`#shop-name`).required = setup;
    $(`#auth-password`).autocomplete = setup
      ? `new-password`
      : `current-password`;
    state.setupMode = setup;
  } catch (error) {
    $(`#auth-error`).textContent = readableError(error);
    $(`#auth-error`).classList.remove(`hidden`);
  }
}
async function showApp(user) {
  state.user = await getUserProfile(user.uid);
  await loadSettings();
  $(`#auth-view`).classList.add(`hidden`);
  $(`#app`).classList.remove(`hidden`);
  $(`#boot`).classList.add(`hidden`);
  $(`#user-name`).textContent = state.user.name;
  $(`#user-role`).textContent =
    state.user.role === `admin` ? `مدير النظام` : `مشغل`;
  $(`#user-avatar`).textContent = state.user.name.trim().charAt(0);
  $(`#brand-shop`).textContent = state.settings.shopName;
  state.module = can(state.user, `dashboard`, `view`)
    ? `dashboard`
    : allowedNav()[0]?.[0];
  renderNav();
  await navigate(state.module);
}
$(`#auth-form`).onsubmit = async (event) => {
  event.preventDefault();
  const submit = $(`#auth-submit`);
  const errorBox = $(`#auth-error`);
  submit.disabled = true;
  errorBox.classList.add(`hidden`);
  try {
    if (state.setupMode) {
      state.setupInProgress = true;
      const user = await setupFirstAdmin({
        name: $(`#auth-name`).value.trim(),
        shopName: $(`#shop-name`).value.trim(),
        email: $(`#auth-email`).value.trim(),
        password: $(`#auth-password`).value,
      });
      state.setupInProgress = false;
      await showApp(user);
    } else
      await login($(`#auth-email`).value.trim(), $(`#auth-password`).value);
  } catch (error) {
    state.setupInProgress = false;
    errorBox.textContent = readableError(error);
    errorBox.classList.remove(`hidden`);
  } finally {
    submit.disabled = false;
  }
};
$(`#logout-btn`).onclick = logout;
$(`#quick-sale-btn`).onclick = () => navigate(`pos`);
$(`#refresh-btn`).onclick = () => navigate(state.module);
$(`#help-btn`).onclick = () => startTour(state.module, true);
$$(`[data-close-dialog]`).forEach(
  (button) => (button.onclick = closeEntityDialog),
);
$(`#entity-dialog`).addEventListener(`click`, (event) => {
  if (event.target === event.currentTarget) closeEntityDialog();
});
$(`#confirm-dialog`).addEventListener(`click`, (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close(`cancel`);
});
$$(`dialog`).forEach((dialog) =>
  dialog.addEventListener(`close`, unlockDialogScroll),
);
$(`#tour-prev`).onclick = () => {
  if (!activeTour || activeTour.index === 0) return;
  activeTour.index -= 1;
  renderTour();
};
$(`#tour-next`).onclick = () => {
  if (!activeTour) return;
  if (activeTour.index === activeTour.steps.length - 1) endTour(true);
  else {
    activeTour.index += 1;
    renderTour();
  }
};
$(`#tour-close`).onclick = () => endTour(true);
$(`#tour-overlay`).onclick = (event) => {
  if (event.target === event.currentTarget) endTour(true);
};
document.addEventListener(`keydown`, (event) => {
  if (event.key === `Escape` && activeTour) endTour(true);
});
watchAuth(async (user) => {
  if (state.setupInProgress) return;
  try {
    if (user) await showApp(user);
    else await showAuth();
  } catch (error) {
    await logout().catch(() => {});
    await showAuth();
    $(`#auth-error`).textContent = readableError(error);
    $(`#auth-error`).classList.remove(`hidden`);
  }
});
