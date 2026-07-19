# نظام الأصيل للإطارات والزيوت المعدنية

نظام عربي RTL يعمل مباشرة على GitHub Pages باستخدام HTML وCSS وJavaScript وFirebase Authentication وCloud Firestore.

## التشغيل الأول

1. افتح **Firebase Console → Authentication → Sign-in method** وفعّل **Email/Password**.
2. افتح **Firestore Database** وأنشئ قاعدة البيانات في وضع Production.
3. انسخ محتوى `firestore.rules` إلى **Firestore Database → Rules** ثم اضغط Publish.
4. افتح رابط الموقع. ستظهر شاشة تهيئة أول مدير مرة واحدة فقط.
5. أدخل اسم المدير والبريد وكلمة المرور واسم المحل. تُنشأ وثيقتا `users/{uid}` و`settings/bootstrap` في عملية واحدة.

> مهم: بعد إنشاء أول مدير لا تسمح القواعد بإنشاء مدير أول آخر. لا تحذف `settings/bootstrap`.

## النشر على GitHub Pages

من المستودع افتح **Settings → Pages**، ثم اختر **Deploy from a branch**، والفرع `main` والمجلد `/ (root)`، ثم Save. الرابط المتوقع:

`https://baselghanem.github.io/Odai/`

## الوحدات المنفذة

- لوحة مؤشرات للمبيعات والربح والمصاريف والمشتريات والمخزون والإيجارات.
- نقطة بيع للمنتجات والخدمات مع الخصم وطرق الدفع وطباعة فاتورة حرارية.
- خصم المخزون داخل Firestore Transaction لمنع البيع بأرصدة قديمة.
- مشتريات ترفع المخزون وتسجل حركة المخزون وتكلفة الشراء.
- منتجات، خدمات، زبائن، موردون، موظفون، رواتب، سلف، ومصاريف.
- تأجير مواد قابلة للتأجير وإرجاعها فعليا للمخزون.
- تقارير حسب الفترة، طباعة، وتصدير CSV عربي.
- مستخدم Admin أو Operator وصلاحيات حسب الوحدة والإجراء.
- Soft delete للسجلات الأساسية وسجل تدقيق غير قابل للتعديل.
- تخزين مؤقت محلي لـFirestore، تحميل محدود، وفلاتر تاريخية لتقليل القراءات.

## إضافة Operator

لأن إنشاء مستخدم Firebase من المتصفح يسجّل خروجه من حساب المدير الحالي، الإجراء الآمن المجاني هو:

1. أنشئ المستخدم من **Firebase Authentication → Users → Add user**.
2. انسخ UID.
3. أنشئ مستندا في `users/{UID}` بهذه الحقول:

```json
{
  "name": "اسم المستخدم",
  "email": "user@example.com",
  "role": "operator",
  "active": true,
  "isDeleted": false,
  "permissions": {
    "dashboard": ["view"],
    "pos": ["view", "create", "print"],
    "products": ["view"],
    "services": ["view"],
    "customers": ["view", "create"],
    "invoices": ["view", "print"]
  }
}
```

أضف حقول `createdAt` و`updatedAt` من نوع Timestamp، و`createdBy` بقيمة UID المدير.

## بنية Firestore

المجموعات: `users`, `roles`, `permissions`, `products`, `services`, `patchTypes`, `customers`, `suppliers`, `purchases`, `purchaseItems`, `sales`, `saleItems`, `invoices`, `rentals`, `employees`, `salaries`, `advances`, `expenses`, `stockMovements`, `cashMovements`, `offers`, `settings`, `auditLogs`, `dailyClosings`.

السجلات التجارية تستخدم `createdAt`, `updatedAt`, `createdBy`, `updatedBy` عند التعديل، و`isDeleted` للحذف المنطقي.

## قيود معمارية مهمة

GitHub Pages + Firebase Free Plan حل Client-only. قواعد Firestore تتحكم بالوصول إلى الوثيقة كاملة ولا تستطيع إخفاء حقل تكلفة واحد داخل وثيقة مسموح بقراءتها. لذلك لا تمنح المشغل صلاحية قراءة `products` إذا كانت سرية التكلفة شرطا محاسبيا صارما؛ الفصل الكامل للتكلفة والحسابات الموثوقة يتطلب مجموعة تكلفة منفصلة وCloud Functions/خادما موثوقا.

## قائمة QA

- [ ] تفعيل Email/Password ونشر القواعد قبل فتح الموقع.
- [ ] إنشاء المدير الأول مرة واحدة وتسجيل الدخول بعد الخروج.
- [ ] إنشاء منتج برصيد، ثم بيعه والتحقق من انخفاض الرصيد.
- [ ] محاولة بيع كمية أكبر من المتوفر والتأكد من الرفض.
- [ ] تسجيل شراء والتحقق من زيادة المخزون وحركة المخزون.
- [ ] تعريف منتج قابل للتأجير، تأجيره، ثم إرجاعه.
- [ ] إضافة مصروف وراتب وسلفة والتحقق من التقارير.
- [ ] فحص الطباعة الحرارية وتصدير CSV.
- [ ] اختبار الواجهة على 360 و390 و430 و768 بكسل.
- [ ] تجربة Operator بصلاحيات محدودة والتأكد من إخفاء الوحدات غير المسموحة.
