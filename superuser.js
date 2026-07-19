import { auth, db } from "./firebase.js?v=20260719-7";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocsFromServer,
  limit,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const RESET_PHRASE = `تصفير بيانات الأصيل`;
const BATCH_SIZE = 400;
const COLLECTIONS = [
  { key: `saleItems`, label: `تفاصيل المبيعات` },
  { key: `sales`, label: `المبيعات والفواتير` },
  { key: `invoices`, label: `سجلات الفواتير` },
  { key: `purchaseItems`, label: `تفاصيل المشتريات` },
  { key: `purchases`, label: `المشتريات` },
  { key: `stockMovements`, label: `حركات المخزون` },
  { key: `cashMovements`, label: `الحركات النقدية` },
  { key: `rentals`, label: `الإيجارات` },
  { key: `expenses`, label: `المصاريف` },
  { key: `salaries`, label: `الرواتب` },
  { key: `advances`, label: `السلف` },
  { key: `employees`, label: `الموظفون` },
  { key: `customers`, label: `الزبائن` },
  { key: `suppliers`, label: `الموردون` },
  { key: `offers`, label: `العروض` },
  { key: `services`, label: `الخدمات` },
  { key: `patchTypes`, label: `أنواع الرقع` },
  { key: `products`, label: `المنتجات والمخزون` },
  { key: `auditLogs`, label: `سجل العمليات` },
];

const state = {
  user: null,
  profile: null,
  counts: new Map(),
  countsReady: false,
  resetInProgress: false,
};

const $ = (selector) => document.querySelector(selector);
const els = {
  boot: $(`#owner-boot`),
  app: $(`#owner-app`),
  denied: $(`#access-denied`),
  deniedMessage: $(`#access-message`),
  ownerName: $(`#owner-name`),
  ownerEmail: $(`#owner-email`),
  ownerAvatar: $(`#owner-avatar`),
  totalCount: $(`#total-count`),
  lastReset: $(`#last-reset`),
  list: $(`#collection-list`),
  alert: $(`#owner-alert`),
  refresh: $(`#refresh-counts`),
  openReset: $(`#open-reset`),
  resetReadiness: $(`#reset-readiness`),
  dialog: $(`#reset-dialog`),
  password: $(`#owner-password`),
  phrase: $(`#confirmation-input`),
  checkbox: $(`#confirmation-check`),
  confirm: $(`#confirm-reset`),
  cancel: $(`#cancel-reset`),
  progress: $(`#reset-progress`),
  progressBar: $(`#progress-bar`),
  progressTitle: $(`#progress-title`),
  progressDetail: $(`#progress-detail`),
  resetError: $(`#reset-error`),
  logout: $(`#owner-logout`),
};

const formatNumber = (value) =>
  new Intl.NumberFormat(`ar-JO`).format(Number(value) || 0);

function readableError(error) {
  const code = error?.code || ``;
  if (
    code.includes(`invalid-credential`) ||
    code.includes(`wrong-password`) ||
    code.includes(`invalid-login-credentials`)
  )
    return `كلمة المرور غير صحيحة.`;
  if (code.includes(`too-many-requests`))
    return `تم إيقاف المحاولات مؤقتًا. انتظر قليلًا ثم حاول من جديد.`;
  if (code.includes(`permission-denied`))
    return `قواعد Firestore لم تُنشر بعد أو أن الحساب الحالي ليس الحساب الرئيسي.`;
  if (code.includes(`network-request-failed`) || code.includes(`unavailable`))
    return `تعذر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجددًا.`;
  return error?.message || `حدث خطأ غير متوقع.`;
}

function showAlert(message, type = `error`) {
  els.alert.textContent = message;
  els.alert.className = `owner-alert ${type === `success` ? `success` : ``}`;
  els.alert.classList.remove(`hidden`);
}

function hideAlert() {
  els.alert.classList.add(`hidden`);
}

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return `لم يتم بعد`;
  return new Intl.DateTimeFormat(`ar-JO`, {
    dateStyle: `medium`,
    timeStyle: `short`,
  }).format(timestamp.toDate());
}

function renderCollectionRows(loading = false) {
  els.list.innerHTML = COLLECTIONS.map(({ key, label }) => {
    const count = state.counts.get(key);
    const value = loading || count === undefined ? `—` : formatNumber(count);
    return `<div class="collection-row" data-collection-row="${key}">
      <span><strong>${label}</strong><small>${key}</small></span>
      <span class="collection-count ${loading ? `count-skeleton` : ``}" data-collection-count="${key}">${value}</span>
    </div>`;
  }).join(``);
}

function updateResetReadiness() {
  const total = [...state.counts.values()].reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  els.totalCount.textContent = state.countsReady ? formatNumber(total) : `—`;
  els.openReset.disabled = !state.countsReady || state.resetInProgress;
  if (!state.countsReady) {
    els.resetReadiness.textContent = `يجب تحميل أعداد السجلات أولًا.`;
  } else if (total === 0) {
    els.resetReadiness.textContent = `النظام نظيف حاليًا، ويمكن تنفيذ التصفير للتأكد.`;
  } else {
    els.resetReadiness.textContent = `${formatNumber(total)} سجلًا تجريبيًا جاهزًا للتصفير.`;
  }
}

async function loadCounts({ quiet = false } = {}) {
  if (state.resetInProgress) return;
  state.countsReady = false;
  state.counts.clear();
  updateResetReadiness();
  renderCollectionRows(true);
  els.refresh.disabled = true;
  if (!quiet) hideAlert();
  try {
    const results = await Promise.all(
      COLLECTIONS.map(async ({ key }) => {
        const snapshot = await getCountFromServer(collection(db, key));
        return [key, snapshot.data().count];
      }),
    );
    results.forEach(([key, count]) => state.counts.set(key, count));
    state.countsReady = true;
    renderCollectionRows();
    updateResetReadiness();
  } catch (error) {
    renderCollectionRows();
    showAlert(`تعذر قراءة بيانات الموقع: ${readableError(error)}`);
  } finally {
    els.refresh.disabled = false;
  }
}

function updateConfirmationState() {
  const phraseMatches = els.phrase.value.trim() === RESET_PHRASE;
  const hasPassword = els.password.value.length >= 6;
  els.confirm.disabled =
    state.resetInProgress ||
    !phraseMatches ||
    !hasPassword ||
    !els.checkbox.checked;
}

function resetDialogFields() {
  els.password.value = ``;
  els.phrase.value = ``;
  els.checkbox.checked = false;
  els.progress.classList.add(`hidden`);
  els.resetError.classList.add(`hidden`);
  els.progressBar.style.width = `0%`;
  els.progressTitle.textContent = `جاري التحضير…`;
  els.progressDetail.textContent = ``;
  updateConfirmationState();
}

function openResetDialog() {
  if (!state.countsReady || state.resetInProgress) return;
  resetDialogFields();
  els.dialog.showModal();
  requestAnimationFrame(() => els.password.focus());
}

function closeResetDialog() {
  if (state.resetInProgress) return;
  els.dialog.close();
  resetDialogFields();
}

function setProgress(index, detail, percentage) {
  els.progress.classList.remove(`hidden`);
  els.progressBar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
  els.progressTitle.textContent = index;
  els.progressDetail.textContent = detail;
}

async function deleteCollection(collectionName, onDeleted) {
  let deleted = 0;
  while (true) {
    const snapshot = await getDocsFromServer(
      query(collection(db, collectionName), limit(BATCH_SIZE)),
    );
    if (snapshot.empty) return deleted;
    const batch = writeBatch(db);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    deleted += snapshot.size;
    onDeleted(deleted);
  }
}

async function runReset() {
  if (els.confirm.disabled || state.resetInProgress || !auth.currentUser)
    return;
  state.resetInProgress = true;
  updateConfirmationState();
  els.cancel.disabled = true;
  els.resetError.classList.add(`hidden`);
  els.password.disabled = true;
  els.phrase.disabled = true;
  els.checkbox.disabled = true;
  setProgress(`التحقق من الهوية`, `إعادة تأكيد كلمة المرور`, 2);

  try {
    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      els.password.value,
    );
    await reauthenticateWithCredential(auth.currentUser, credential);

    let completed = 0;
    for (const { key, label } of COLLECTIONS) {
      const row = document.querySelector(`[data-collection-row="${key}"]`);
      row?.classList.add(`active`);
      const startPercentage = 4 + (completed / COLLECTIONS.length) * 92;
      setProgress(
        `جاري حذف ${label}`,
        `${completed + 1} من ${COLLECTIONS.length}`,
        startPercentage,
      );
      await deleteCollection(key, (deleted) => {
        const counter = document.querySelector(
          `[data-collection-count="${key}"]`,
        );
        if (counter) counter.textContent = `−${formatNumber(deleted)}`;
      });
      row?.classList.remove(`active`);
      row?.classList.add(`done`);
      completed += 1;
      setProgress(
        `تم حذف ${label}`,
        `${completed} من ${COLLECTIONS.length}`,
        4 + (completed / COLLECTIONS.length) * 92,
      );
    }

    await setDoc(
      doc(db, `settings`, `resetState`),
      {
        lastResetAt: serverTimestamp(),
        lastResetBy: auth.currentUser.uid,
        lastResetByName: state.profile?.name || auth.currentUser.email,
        preservedCollections: [`users`, `settings`, `roles`, `permissions`],
      },
      { merge: true },
    );
    setProgress(`اكتمل التصفير بنجاح`, `النظام جاهز للبداية الفعلية`, 100);
    await new Promise((resolve) => setTimeout(resolve, 650));
    state.resetInProgress = false;
    els.dialog.close();
    showAlert(
      `تم حذف بيانات التجربة بالكامل. حسابات المستخدمين وإعدادات المحل بقيت محفوظة، والنظام جاهز للعمل الفعلي.`,
      `success`,
    );
    await loadResetState();
    await loadCounts({ quiet: true });
  } catch (error) {
    state.resetInProgress = false;
    els.resetError.textContent = `توقف التصفير: ${readableError(error)} يمكنك المحاولة مرة أخرى؛ العملية قابلة للتكرار بأمان حتى تكتمل.`;
    els.resetError.classList.remove(`hidden`);
    els.cancel.disabled = false;
    els.password.disabled = false;
    els.phrase.disabled = false;
    els.checkbox.disabled = false;
    updateConfirmationState();
  }
}

async function loadResetState() {
  try {
    const snapshot = await getDoc(doc(db, `settings`, `resetState`));
    els.lastReset.textContent = snapshot.exists()
      ? formatTimestamp(snapshot.data().lastResetAt)
      : `لم يتم بعد`;
  } catch {
    els.lastReset.textContent = `غير متاح`;
  }
}

function showDenied(message) {
  els.boot.classList.add(`hidden`);
  els.app.classList.add(`hidden`);
  els.deniedMessage.textContent = message;
  els.denied.classList.remove(`hidden`);
}

async function authorize(user) {
  if (!user) {
    window.location.replace(`./index.html`);
    return;
  }
  try {
    const [profileSnapshot, bootstrapSnapshot] = await Promise.all([
      getDoc(doc(db, `users`, user.uid)),
      getDoc(doc(db, `settings`, `bootstrap`)),
    ]);
    if (!profileSnapshot.exists() || !bootstrapSnapshot.exists())
      throw new Error(`تعذر التحقق من إعداد الحساب الرئيسي.`);

    const profile = profileSnapshot.data();
    const isOwner =
      profile.role === `admin` &&
      profile.active === true &&
      profile.isDeleted === false &&
      bootstrapSnapshot.data().adminUid === user.uid;
    if (!isOwner) {
      showDenied(
        `هذه الصفحة لا تظهر للمديرين العاديين؛ هي مخصصة فقط للحساب الأول الذي هيّأ النظام.`,
      );
      return;
    }

    state.user = user;
    state.profile = profile;
    els.ownerName.textContent = profile.name || `مالك النظام`;
    els.ownerEmail.textContent = profile.email || user.email || ``;
    els.ownerAvatar.textContent = (profile.name || user.email || `م`)
      .trim()
      .charAt(0);
    els.boot.classList.add(`hidden`);
    els.denied.classList.add(`hidden`);
    els.app.classList.remove(`hidden`);
    renderCollectionRows(true);
    await Promise.all([loadResetState(), loadCounts()]);
  } catch (error) {
    showDenied(readableError(error));
  }
}

els.refresh.addEventListener(`click`, () => loadCounts());
els.openReset.addEventListener(`click`, openResetDialog);
els.cancel.addEventListener(`click`, closeResetDialog);
els.confirm.addEventListener(`click`, runReset);
[els.password, els.phrase].forEach((input) =>
  input.addEventListener(`input`, updateConfirmationState),
);
els.checkbox.addEventListener(`change`, updateConfirmationState);
els.dialog.addEventListener(`cancel`, (event) => {
  if (state.resetInProgress) event.preventDefault();
});
els.logout.addEventListener(`click`, async () => {
  if (state.resetInProgress) return;
  await signOut(auth);
  window.location.replace(`./index.html`);
});
window.addEventListener(`beforeunload`, (event) => {
  if (!state.resetInProgress) return;
  event.preventDefault();
  event.returnValue = ``;
});

renderCollectionRows(true);
onAuthStateChanged(auth, authorize);
