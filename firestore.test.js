const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = "demo-no-project";
const ADMIN_UID = "admin_uid_123";
const SALESMAN_UID = "salesman_uid_456";
const SALESMAN_PHONE = "01800000000";

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8085,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Full Admin Sync -> Salesman Connect -> Salesman Sync CUJ", async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  const salesmanDb = testEnv.authenticatedContext(SALESMAN_UID).firestore();

  // 1. Admin creates business profile
  await assertSucceeds(
    adminDb.collection("businesses").doc(ADMIN_UID).set({
      id: ADMIN_UID,
      ownerUid: ADMIN_UID,
      businessName: "Test Shop",
      phone: "01700000000",
      updatedAt: Date.now(),
    })
  );

  // 2. Admin adds salesman to staff and staff_by_phone
  await assertSucceeds(
    adminDb.collection("businesses").doc(ADMIN_UID).collection("staff").doc("salesman_local_1").set({
      id: "salesman_local_1",
      name: "Karim",
      phone: SALESMAN_PHONE,
      role: "SALESMAN",
      isActive: true,
      businessId: ADMIN_UID,
      updatedAt: Date.now(),
    })
  );

  await assertSucceeds(
    adminDb.collection("businesses").doc(ADMIN_UID).collection("staff_by_phone").doc(SALESMAN_PHONE).set({
      id: "salesman_local_1",
      name: "Karim",
      phone: SALESMAN_PHONE,
      role: "SALESMAN",
      isActive: true,
      businessId: ADMIN_UID,
      updatedAt: Date.now(),
    })
  );

  // 3. Salesman Step 1: Read business doc
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).get()
  );

  // 4. Salesman Step 2: Read own staff doc
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("staff").doc(SALESMAN_UID).get()
  );

  // 5. Salesman Step 3: Read staff_by_phone
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("staff_by_phone").doc(SALESMAN_PHONE).get()
  );

  // 6. Salesman Step 4: Write staff profile /businesses/{adminUid}/staff/{salesmanUid}
  console.log("Testing Salesman Step 4: writing /businesses/{adminUid}/staff/{salesmanUid}");
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("staff").doc(SALESMAN_UID).set({
      id: SALESMAN_UID,
      name: "Karim",
      phone: SALESMAN_PHONE,
      email: "salesman@gmail.com",
      role: "SALESMAN",
      isActive: true,
      businessId: ADMIN_UID,
      linkedAt: Date.now(),
    }, { merge: true })
  );

  // 7. Salesman Step 5: Write staff membership /staff_memberships/{salesmanUid}
  console.log("Testing Salesman Step 5: writing /staff_memberships/{salesmanUid}");
  await assertSucceeds(
    salesmanDb.collection("staff_memberships").doc(SALESMAN_UID).set({
      userId: SALESMAN_UID,
      businessId: ADMIN_UID,
      role: "SALESMAN",
      isActive: true,
      phone: SALESMAN_PHONE,
      email: "salesman@gmail.com",
      updatedAt: Date.now(),
    }, { merge: true })
  );

  // 8. Salesman Step 7 (Sync):
  console.log("Testing Salesman Step 7: read tombstones");
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("tombstones").get()
  );

  console.log("Testing Salesman Step 7: read products");
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("products").get()
  );

  console.log("Testing Salesman Step 7: read customers");
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("customers").get()
  );

  console.log("Testing Salesman Step 7: write customer");
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("customers").doc("cust_1").set({
      id: "cust_1",
      name: "Customer 1",
      phone: "01711111111",
      currentDue: 0.0,
      totalBilled: 0.0,
      totalPaid: 0.0,
      isDeleted: false,
      businessId: ADMIN_UID,
    }, { merge: true })
  );

  console.log("Testing Salesman Step 7: write sale");
  await assertSucceeds(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("sales").doc("inv_1").set({
      invoiceNumber: "inv_1",
      customerId: "cust_1",
      salesmanId: SALESMAN_UID,
      totalAmount: 500.0,
      paidAmount: 500.0,
      dueAmount: 0.0,
      isDeleted: false,
      businessId: ADMIN_UID,
    }, { merge: true })
  );
});

test("Failure Case 1: When Admin didn't sync or staff_by_phone missing", async () => {
  const salesmanDb = testEnv.authenticatedContext(SALESMAN_UID).firestore();

  // If staff_by_phone does NOT exist:
  await assertFails(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("staff").doc(SALESMAN_UID).set({
      id: SALESMAN_UID,
      name: "Karim",
      phone: SALESMAN_PHONE,
      email: "salesman@gmail.com",
      role: "SALESMAN",
      isActive: true,
      businessId: ADMIN_UID,
      linkedAt: Date.now(),
    }, { merge: true })
  );
});

test("Failure Case 2: When Business ID is 'admin' instead of Admin's Firebase UID", async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

  // Admin tries to create business profile with ID 'admin'
  console.log("Testing Admin write to businesses/admin:");
  await assertFails(
    adminDb.collection("businesses").doc("admin").set({
      id: "admin",
      ownerUid: ADMIN_UID,
      businessName: "Test Shop",
      phone: "01700000000",
      updatedAt: Date.now(),
    })
  );
});

test("Failure Case 3: Salesman tries to write product", async () => {
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  const salesmanDb = testEnv.authenticatedContext(SALESMAN_UID).firestore();

  // Admin sets up staff
  await adminDb.collection("businesses").doc(ADMIN_UID).collection("staff").doc(SALESMAN_UID).set({
    id: SALESMAN_UID,
    name: "Karim",
    phone: SALESMAN_PHONE,
    role: "SALESMAN",
    isActive: true,
    businessId: ADMIN_UID,
    updatedAt: Date.now(),
  });

  // Salesman tries to create product
  console.log("Testing Salesman write to products (should FAIL):");
  await assertFails(
    salesmanDb.collection("businesses").doc(ADMIN_UID).collection("products").doc("prod_1").set({
      id: "prod_1",
      name: "T-Shirt",
      category: "Clothes",
      sellingPrice: 500,
      currentStock: 10,
      businessId: ADMIN_UID,
    })
  );
});

