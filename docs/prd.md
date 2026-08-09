# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Fuzdrop

### 1.2 Application Description
Fuzdrop is a campus-based multi-vendor food delivery mobile application serving university ecosystems. The platform connects four distinct user groups: Students/Staff (Customers), Campus Food Vendors/Cafeterias, Student Delivery Runners (Operators), and Platform Administrators (Super Admin) through a unified digital marketplace with integrated wallet system, real-time order management, and comprehensive administrative controls.

### 1.3 Brand Identity
- Primary Accent Color: #F25C19 (Vibrant Orange)
  - Applied to: Primary action buttons, checkout triggers, active bottom navigation tabs, brand logos
- Core Background Color: #FAF6F0 (Warm Cream/Off-White)
  - Applied to: All page backgrounds
- Typography: High-contrast dark text for headers, titles, item pricing

## 2. Users and Usage Scenarios

### 2.1 Target Users
- **Customers**: University students and staff members ordering food
- **Vendors**: Campus cafeterias and food vendors managing menus and orders
- **Operators**: Student delivery runners fulfilling delivery tasks
- **Super Admin**: Platform administrators with full system control and monitoring capabilities

### 2.2 Core Usage Scenarios
- Customers browse vendor listings, select menu items, place orders with campus dropoff locations, and manage digital wallet balance
- Vendors receive orders, update menu availability, track earnings
- Operators accept delivery tasks, view dropoff locations and delivery notes, complete deliveries
- Super Admin monitors platform activity, manages vendors and menus, handles order overrides and refunds, broadcasts announcements, analyzes platform metrics
- All user roles access Customer Care screen to contact support, view FAQs, or submit support requests

## 3. Database Collections Structure

### 3.1 Users Collection
- Email (Text)
- Phone Number (Text)
- Name (Text)
- Profile Image (Image): Optional field
- Role (Text): Values include 'Customer', 'Vendor', 'Operator', 'Admin'

### 3.2 Vendors Collection
- Name (Text)
- Image (Image)
- Status (Text): Values include 'Open', 'Closed', 'Suspended'
- Orders Paused (Boolean): True/False for individual vendor order pause

### 3.3 Menus Collection
- Relationship: One-to-Many with Vendors (A Vendor can have multiple Menu items)
- Item Name (Text)
- Description (Text)
- Price (Number)
- Image (Image)
- Is Active (Boolean): True/False switch
- Category (Text): Food category classification

### 3.4 Orders Collection
- Relationship: Many-to-Many or One-to-Many linking Customer, Vendor, and Runner
- Order ID (Text)
- Total Price (Number)
- Status (Text): Values include 'Pending', 'Preparing', 'Out for Delivery', 'Arrived at Dropoff', 'Completed', 'Cancelled'
- Created Date (Date/Time)
- Campus Dropoff Location (Relationship to Campus Dropoff Locations)
- Location Description (Text)
- Delivery Notes (Text)

### 3.5 Campus Dropoff Locations Collection
- Location Name (Text): Examples include \"Amina Hostel Porter's Desk\", \"Faculty of Engineering LT 1\", \"University Library Gate\"
- Note: Pre-seeded by platform owner before app launch

### 3.6 Wallets Collection
- Relationship: One-to-One with Users
- Customer Balance (Number)
- Vendor Balance (Number)
- Platform Owner Balance (Number): Accumulates delivery fees
- Free Delivery Passes (Number): Customer loyalty credits

### 3.7 Transactions Collection
- Amount (Number)
- Transaction Type (Text): Values include 'Debit', 'Credit', 'Refund'
- Reference ID (Text)
- Created Date (Date/Time)
- Related Order (Relationship to Orders)
- Related User (Relationship to Users)

### 3.8 Support Requests Collection
- Subject (Text)
- Message (Text)
- Submitted By (Relationship to Users)
- Created Date (Date/Time)

### 3.9 Platform Settings Collection
- Global Order Freeze (Boolean): True/False for platform-wide order pause
- Last Updated (Date/Time)

### 3.10 Announcements Collection
- Title (Text)
- Message (Text)
- Target Audience (Text): Values include 'Customers', 'Vendors', 'Operators', 'All Users'
- Created Date (Date/Time)
- Created By (Relationship to Users with Role='Admin')

## 4. Page Structure and Functional Specifications

### 4.1 Page Hierarchy
```
├── Welcome (Onboarding)
│   ├── Registration Form
│   └── Login Form
├── CustomerHome (Customer Dashboard)
│   ├── Featured Vendors List
│   └── Bottom Navigation
├── VendorStoreView (Restaurant Menu Page)
│   ├── Vendor Details Header
│   └── MenuItemRow List
├── CustomerWallet (Digital Wallet Hub)
│   ├── Balance Display
│   └── Top-Up Action
├── OrderCheckout (Campus Checkout Screen)
│   ├── Order Summary
│   ├── Campus Location Dropdown
│   ├── Location Description Input
│   ├── Delivery Notes Input
│   └── Place Order Button
├── VendorDashboard (Runner & Vendor Dashboard)
│   ├── Earnings Display
│   ├── Active Orders List
│   └── Menu Management Controls
├── CustomerCare (Support Screen)
│   ├── Support Contact Section
│   ├── FAQ Section
│   └── Send a Message Form
└── SuperAdminPortal (Admin Spot)
    ├── AdminDashboard (Main Control Center)
    │   ├── Emergency Controls Section
    │   ├── Live KPI Counters
    │   └── Live Order Feed
    ├── VendorManagement
    │   ├── Vendor List with Controls
    │   └── Vendor Editor
    ├── MenuManagement
    │   ├── Menu Editor per Vendor
    │   └── Category Management
    ├── OrderManagement
    │   ├── Order List with Filters
    │   └── Order Override Controls
    ├── UserManagement
    │   ├── Customer Profile List
    │   └── Loyalty Credits Manager
    ├── FinancialOverview
    │   ├── Transaction Ledger
    │   └── Export/Audit Tools
    ├── BroadcastSystem
    │   └── Announcement Composer
    └── PlatformAnalytics
        ├── Peak Hours Chart
        ├── Top Dishes Report
        ├── Fulfillment Metrics
        └── Delivery Hotspots Map
```

### 4.2 Welcome Screen
**Purpose**: Initial entrance hub for user authentication and role assignment

**Components**:
- Registration Form
  - Input fields: Email, Phone Number, Password, Name
  - Profile Image upload: Optional field
  - Role selection automatically assigned during registration
- Login Form
  - Input fields: Email, Password
  - Login action authenticates user and routes to role-specific dashboard
  - Admin users with Role='Admin' routed to /super-admin

### 4.3 CustomerHome (Customer Dashboard)
**Purpose**: Main browsing interface for customers to discover and select vendors

**Components**:
- Featured Vendors List
  - Custom layout component 'VendorCard' bound to Vendors collection
  - Displays all vendors without category filtering
  - Each card displays: Vendor Name, Image, Status
  - Vendors with Orders Paused=True or Status='Suspended' display unavailable badge
  - Tapping card navigates to VendorStoreView
- Bottom Navigation
  - Active tab highlighted with #F25C19 accent color
  - Includes navigation to CustomerCare screen
- Device Permissions Configuration
  - Notifications access
  - Photo Library access
  - Camera access

### 4.4 VendorStoreView (Restaurant Menu Page)
**Purpose**: Display selected vendor's menu items for ordering

**Components**:
- Vendor Details Header
  - Displays: Vendor Name, Image, Status
- MenuItemRow List Component
  - Bound to Menus collection filtered by selected vendor
  - Each row displays: Item Name, Image, Price, Is Active status, Category
  - **Availability Indicator**: Each MenuItemRow displays a clear availability badge or switch showing current Is Active status (e.g., \"Available\" when True, \"Unavailable\" when False)
  - **Availability Toggle Action**: Each MenuItemRow includes a tap/toggle action that allows vendors to directly update the Is Active field in the Menus collection instantly
  - For customers: Only items with Is Active = True are visible
  - For vendors: All items are visible with availability toggle controls
  - Add to cart action for each item (customer view only)

### 4.5 CustomerWallet (Digital Wallet Hub)
**Purpose**: Manage customer's digital wallet balance

**Components**:
- Balance Display
  - Shows logged-in user's Wallet > Customer Balance
  - Shows Free Delivery Passes count
  - Format: ₦ symbol with two decimal points (e.g., ₦1,500.00)
- Top-Up Action
  - Custom action to increase Customer Balance
  - Updates Wallets collection and logs transaction in Transactions collection

### 4.6 OrderCheckout (Campus Checkout Screen)
**Purpose**: Finalize order with campus-specific delivery details and payment

**Components**:
- Order Summary Section
  - Lists selected menu items with quantities and individual prices
  - Calculates Subtotal (sum of food items only)
  - Displays Flat Delivery Fee: ₦245.00 (fixed amount, waived if Free Delivery Passes > 0)
  - Calculates Total Price = Subtotal + ₦245.00 (or Subtotal if pass used)
  - Format all prices with ₦ symbol and two decimal points
- Campus Location Selection
  - Mandatory dropdown populated from Campus Dropoff Locations collection (pre-seeded by platform owner)
  - Displays Location Name options
- Location Description Input
  - Multi-line Text Input field
  - Purpose: Allow customers to describe exact location in more detail
  - Placeholder example: \"I'm at the second floor, room 204\"
- Delivery Notes Input
  - Multi-line Text Input field
  - Placeholder example: \"Meet me at the porter's lodge\"
- Place Order Button
  - Primary action button styled with #F25C19 accent color
  - Conditional Visibility Logic: Button only visible/clickable IF Logged In User > Wallet > Customer Balance >= Order Total Price AND Platform Settings > Global Order Freeze = False AND Selected Vendor > Orders Paused = False
  - If balance insufficient: Hide button or display modal directing user to top up wallet
  - If orders frozen: Display message indicating orders temporarily unavailable
  - On successful order placement:
    - Create new record in Orders collection
    - Deduct Total Price from Customer Balance (or deduct Free Delivery Pass if used)
    - Credit Subtotal to Vendor Balance
    - Credit ₦245.00 delivery fee to Platform Owner Balance (if not waived)
    - Log transactions in Transactions collection
    - Update order Status to 'Pending'

### 4.7 VendorDashboard (Runner & Vendor Dashboard)
**Purpose**: Unified dashboard for vendors and operators to manage orders and inventory

**Components for Vendors**:
- Earnings Display
  - Shows Vendor Balance from Wallets collection
  - Format: ₦ symbol with two decimal points
- Active Orders List
  - Displays orders filtered by vendor with Status: 'Pending', 'Preparing', 'Out for Delivery'
  - Each order shows: Order ID, Customer Name, Items, Total Price, Status, Created Date
- Menu Management Controls
  - Toggle switches to update Is Active status
  - Changes immediately update Menus collection

**Components for Operators (Student Delivery Runners)**:
- Active Delivery Tasks List
  - Displays orders assigned to runner with Status: 'Out for Delivery'
  - Each task shows: Order ID, Vendor Name, Campus Dropoff Location Name, Location Description, Delivery Notes, Total Price
  - Action to update Status to 'Arrived at Dropoff' or 'Completed'

### 4.8 CustomerCare (Support Screen)
**Purpose**: Provide support resources and contact channels for all user roles

**Access**: Accessible from bottom navigation bar or profile/settings menu for all user roles (Customers, Vendors, Operators)

**Components**:
- Support Contact Section
  - Displays WhatsApp/phone number for platform support team
  - Displays email address for platform support team
- FAQ Section
  - List of common questions and answers
  - Example questions:
    - \"How do I top up my wallet?\"
    - \"What happens if my order is delayed?\"
    - \"How do I mark an item as unavailable?\"
- Send a Message / Report an Issue Form
  - Subject field (Text Input)
  - Message field (Multi-line Text Input)
  - Submit button styled with #F25C19 accent color
  - On submission: Creates new record in Support Requests collection with Subject, Message, Submitted By (linked to logged-in user), Created Date

### 4.9 SuperAdminPortal (Admin Spot)
**Purpose**: Comprehensive administrative control center for platform management

**Access Control**: 
- Protected route /super-admin with strict RBAC
- Only accessible to users with Role='Admin'
- Non-admin users attempting access are redirected to /

#### 4.9.1 AdminDashboard (Main Control Center)
**Purpose**: Real-time platform monitoring and emergency controls

**Components**:
- Emergency Controls Section
  - Global Order Freeze toggle switch
    - Updates Platform Settings > Global Order Freeze field
    - When enabled, all new order placements blocked platform-wide
    - Displays current freeze status prominently
  - Individual Vendor Pause Switches
    - List of all vendors with toggle switches
    - Updates Vendors > Orders Paused field per vendor
    - When enabled, blocks new orders for specific vendor only
- Live KPI Counters (Auto-refreshing)
  - Total Active Orders: Count of orders with Status not 'Completed' or 'Cancelled'
  - Gross Platform Volume: Sum of all order Total Price values (₦ format)
  - Active Customers: Count of users with Role='Customer'
  - Registered Vendors: Count of records in Vendors collection
  - Active Delivery Riders: Count of users with Role='Operator'
- Live Order Feed
  - Auto-refreshing list of recent orders across all vendors
  - Displays: Order ID, Vendor Name, Customer Name, Status, Total Price, Created Date
  - Sorted by Created Date descending

#### 4.9.2 VendorManagement
**Purpose**: Full vendor account administration

**Components**:
- Vendor List with Controls
  - Displays all vendors from Vendors collection
  - Each row shows: Vendor Name, Image, Status, Orders Paused status
  - Actions per vendor:
    - Edit: Navigate to Vendor Editor
    - Suspend: Update Status to 'Suspended'
    - Delete: Remove vendor record (with confirmation)
- Vendor Editor
  - Edit fields: Name, Image, Status
  - Save action updates Vendors collection

#### 4.9.3 MenuManagement
**Purpose**: Complete menu editing capabilities across all vendors

**Components**:
- Vendor Selector
  - Dropdown to select vendor for menu editing
- Menu Editor per Vendor
  - List of all menu items for selected vendor
  - Edit capabilities per item:
    - Item Name (Text Input)
    - Description (Text Input)
    - Price (Number Input)
    - Image (Image Upload)
    - Is Active (Toggle Switch)
    - Category (Text Input or Dropdown)
  - Actions:
    - Save: Update Menus collection
    - Delete: Remove menu item (with confirmation)
    - Add New Item: Create new record in Menus collection
- Category Management
  - Add new food categories
  - Assign categories to menu items

#### 4.9.4 OrderManagement
**Purpose**: Manual order intervention and override controls

**Components**:
- Order List with Filters
  - Displays all orders from Orders collection
  - Filter options: Vendor, Date Range, Status
  - Each row shows: Order ID, Customer Name, Vendor Name, Status, Total Price, Created Date
- Order Override Controls (per order)
  - Force Complete: Update Status to 'Completed'
  - Force Cancel: Update Status to 'Cancelled'
  - Issue Customer Wallet Refund:
    - Credit Customer Balance with order Total Price
    - Log refund transaction in Transactions collection with Type='Refund'
  - Reassign Rider:
    - Dropdown to select new operator
    - Update order assignment to selected operator

#### 4.9.5 UserManagement
**Purpose**: Customer profile administration and loyalty management

**Components**:
- Customer Profile List
  - Displays all users with Role='Customer'
  - Each row shows: Name, Email, Phone Number, Customer Balance, Free Delivery Passes
  - View Order History: Navigate to filtered order list for selected customer
- Loyalty Credits Manager
  - Manual Award Free Delivery Passes:
    - Input field for number of passes
    - Award action updates Wallets > Free Delivery Passes
  - Manual Award Wallet Credits:
    - Input field for amount (₦)
    - Award action updates Wallets > Customer Balance
    - Log transaction in Transactions collection

#### 4.9.6 FinancialOverview
**Purpose**: Complete financial ledger and audit capabilities

**Components**:
- Transaction Ledger
  - Displays all records from Transactions collection
  - Columns: Amount, Transaction Type, Reference ID, Related Order, Related User, Created Date
  - Filter options: Vendor, Date Range, Transaction Type
  - Sort options: Date, Amount
- Export/Audit Tools
  - Export to CSV action
  - Date range selector for export
  - Audit log display showing transaction history

#### 4.9.7 BroadcastSystem
**Purpose**: Platform-wide communication and announcement distribution

**Components**:
- Announcement Composer
  - Title field (Text Input)
  - Message field (Multi-line Text Input)
  - Target Audience selector (Radio buttons or Dropdown)
    - Options: Customers, Vendors, Operators, All Users
  - Send Announcement button
    - Creates record in Announcements collection
    - Triggers Web Push Notification to selected audience
    - Displays banner alert in app for selected audience

#### 4.9.8 PlatformAnalytics
**Purpose**: Data-driven insights and performance metrics

**Components**:
- Peak Ordering Hours Chart
  - Bar chart or line graph showing order volume by hour of day
  - Data aggregated from Orders > Created Date
- Top 5 Selling Dishes Report
  - List of menu items ranked by order frequency
  - Displays: Item Name, Vendor Name, Total Orders, Total Revenue
- Average Order Fulfillment Time
  - Metric calculated from order Created Date to Status='Completed'
  - Displayed in minutes
  - Breakdown by vendor available
- Delivery Hotspots Map
  - Visual representation of Campus Dropoff Locations
  - Heatmap or marker size indicating order volume per location
  - Data aggregated from Orders > Campus Dropoff Location

## 5. Business Rules and Logic

### 5.1 Role-Based Access Control
- Users with Role = 'Customer' access CustomerHome, VendorStoreView, CustomerWallet, OrderCheckout, CustomerCare
- Users with Role = 'Vendor' access VendorDashboard with vendor-specific features, CustomerCare
- Users with Role = 'Operator' access VendorDashboard with runner-specific features, CustomerCare
- Users with Role = 'Admin' access SuperAdminPortal at /super-admin route, all admin features
- Non-admin users attempting to access /super-admin are redirected to /

### 5.2 Order Workflow
1. Customer places order on OrderCheckout screen (if Global Order Freeze=False and Vendor Orders Paused=False)
2. Order Status set to 'Pending'
3. Vendor receives order notification, updates Status to 'Preparing'
4. Operator accepts delivery task, Status updates to 'Out for Delivery'
5. Operator arrives at dropoff location, Status updates to 'Arrived at Dropoff'
6. Customer confirms receipt, Status updates to 'Completed'
7. Vendor Balance credited with food subtotal amount
8. Platform Owner Balance credited with ₦245.00 delivery fee (if not waived by Free Delivery Pass)

### 5.3 Wallet Transaction Rules
- All financial amounts display ₦ symbol with exactly two decimal points
- Customer Balance deducted immediately upon order placement (Total Price = Subtotal + ₦245.00, or Subtotal if Free Delivery Pass used)
- Vendor Balance credited with Subtotal only (food items total)
- Platform Owner Balance credited with ₦245.00 delivery fee (if applicable)
- All transactions logged in Transactions collection with Type ('Debit', 'Credit', or 'Refund'), Amount, Reference ID, Related Order, Related User, Created Date
- Refunds issued by admin credit Customer Balance and log transaction with Type='Refund'

### 5.4 Menu Availability Logic
- Menu items only visible to customers when Is Active = True
- Vendors can update Is Active status via two methods:
  - Directly from VendorStoreView page using availability toggle on each MenuItemRow
  - From VendorDashboard Menu Management Controls
- Admin can update Is Active status via MenuManagement in SuperAdminPortal
- Availability changes take effect instantly and update the Menus collection

### 5.5 Campus Dropoff Location Requirement
- Campus Dropoff Location selection is mandatory on OrderCheckout screen
- Campus Dropoff Locations are pre-seeded by platform owner before app launch
- Location Description field allows customers to provide detailed location information
- Delivery Notes field is optional but recommended for specific instructions

### 5.6 Delivery Fee Distribution
- Fixed delivery fee of ₦245.00 applies to all orders
- Delivery fee waived if customer uses Free Delivery Pass
- Delivery fee is credited to Platform Owner Balance, not Vendor Balance
- Vendor receives only the food subtotal amount

### 5.7 Support Request Handling
- All user roles can submit support requests via CustomerCare screen
- Support requests are logged in Support Requests collection with Subject, Message, Submitted By, Created Date

### 5.8 Emergency Control Rules
- Global Order Freeze: When enabled, all new order placements blocked platform-wide; existing orders continue normal workflow
- Individual Vendor Pause: When enabled for specific vendor, new orders blocked for that vendor only; other vendors unaffected
- Emergency controls take effect immediately upon toggle

### 5.9 Admin Override Authority
- Admin can force complete or cancel any order regardless of current status
- Admin can issue refunds to customers, crediting full order amount to Customer Balance
- Admin can reassign delivery riders to active orders
- Admin can suspend or delete vendor accounts
- Admin can edit any menu item across all vendors
- Admin can manually award Free Delivery Passes or wallet credits to customers

### 5.10 Announcement Broadcast Rules
- Announcements target specific user roles or all users
- Web Push Notifications sent to selected audience upon announcement creation
- Banner alerts displayed in app for selected audience
- Announcements logged in Announcements collection with Title, Message, Target Audience, Created Date, Created By

## 6. Exception and Boundary Conditions

| Scenario | Condition | System Behavior |
|----------|-----------|----------------|
| Insufficient Wallet Balance | Customer Balance < Order Total Price | Hide/disable Place Order button; display modal prompting wallet top-up |
| Inactive Menu Item | Menu item Is Active = False | Hide item from VendorStoreView menu list (customer view) |
| Vendor Closed | Vendor Status = 'Closed' | Display \"Closed\" badge on VendorCard; disable navigation to VendorStoreView |
| Vendor Suspended | Vendor Status = 'Suspended' | Display \"Unavailable\" badge on VendorCard; disable navigation to VendorStoreView |
| Vendor Orders Paused | Vendor Orders Paused = True | Display \"Orders Paused\" message on VendorStoreView; disable Place Order button |
| Global Order Freeze Active | Platform Settings > Global Order Freeze = True | Display platform-wide message on OrderCheckout; disable Place Order button for all vendors |
| Missing Dropoff Location | No Campus Dropoff Location selected | Disable Place Order button; display validation error |
| Order Status Transition | Invalid status change (e.g., 'Completed' to 'Pending') | Prevent status update; log error |
| Empty Support Request | Subject or Message field empty | Disable Submit button; display validation error |
| Unauthorized Admin Access | User with Role ≠ 'Admin' attempts /super-admin route | Redirect to / (home route) |
| Admin Refund Exceeds Order Total | Refund amount > Order Total Price | Display validation error; prevent refund |
| Empty Announcement | Title or Message field empty | Disable Send button; display validation error |

## 7. Acceptance Criteria

1. User completes registration on Welcome screen with Email, Phone Number, Password, Name, and optional Profile Image upload, Role assignment
2. Customer logs in and navigates to CustomerHome, views all vendors in Featured Vendors list without category filtering
3. Customer selects a vendor with Status = 'Open' and Orders Paused = False, navigates to VendorStoreView, views menu items with Is Active = True
4. Customer adds menu items to cart, navigates to OrderCheckout screen
5. Customer selects Campus Dropoff Location from pre-seeded dropdown, enters Location Description and optional Delivery Notes
6. System validates Customer Balance >= Order Total Price AND Global Order Freeze = False AND Vendor Orders Paused = False, displays Place Order button
7. Customer taps Place Order button, order created with Status = 'Pending', Customer Balance deducted by Total Price (or Free Delivery Pass used), Vendor Balance credited with Subtotal, Platform Owner Balance credited with ₦245.00 (if applicable), transactions logged
8. Vendor views order on VendorDashboard, updates Status to 'Preparing', then 'Out for Delivery'
9. Operator views delivery task on VendorDashboard with Campus Dropoff Location Name, Location Description, and Delivery Notes displayed
10. Operator updates Status to 'Arrived at Dropoff', then 'Completed'
11. Vendor Balance reflects food subtotal credit, Platform Owner Balance reflects ₦245.00 delivery fee credit (if applicable), transactions logged in Transactions collection
12. Vendor navigates to VendorStoreView, toggles menu item availability using availability toggle on MenuItemRow, Is Active status updates instantly in Menus collection
13. User (any role) navigates to CustomerCare screen from bottom navigation or profile menu, views support contact information and FAQ section
14. User fills in Subject and Message fields on Send a Message form, taps Submit button, support request logged in Support Requests collection with Submitted By linked to logged-in user
15. Admin user logs in with Role='Admin', routed to /super-admin, accesses AdminDashboard
16. Admin views Live KPI Counters displaying Total Active Orders, Gross Platform Volume, Active Customers, Registered Vendors, Active Delivery Riders
17. Admin toggles Global Order Freeze switch, Platform Settings > Global Order Freeze updated, all new order placements blocked platform-wide
18. Admin toggles individual vendor Orders Paused switch, Vendors > Orders Paused updated, new orders blocked for specific vendor
19. Admin navigates to VendorManagement, views vendor list, edits vendor details, suspends vendor account, Status updated to 'Suspended'
20. Admin navigates to MenuManagement, selects vendor, edits menu item Name/Price/Description, toggles Is Active, adds new menu item, deletes menu item, changes saved to Menus collection
21. Admin navigates to OrderManagement, views order list with filters, selects order, clicks Force Complete, Status updated to 'Completed'
22. Admin clicks Issue Customer Wallet Refund on order, Customer Balance credited with order Total Price, transaction logged with Type='Refund'
23. Admin navigates to UserManagement, views customer profile list, selects customer, manually awards 3 Free Delivery Passes, Wallets > Free Delivery Passes updated
24. Admin navigates to FinancialOverview, views transaction ledger with filters, exports transactions to CSV
25. Admin navigates to BroadcastSystem, composes announcement with Title and Message, selects Target Audience='Customers', sends announcement, record created in Announcements collection, Web Push Notification sent to customers
26. Admin navigates to PlatformAnalytics, views Peak Ordering Hours chart, Top 5 Selling Dishes report, Average Order Fulfillment Time metric, Delivery Hotspots map
27. Non-admin user attempts to access /super-admin route, redirected to / (home route)

## 8. Out of Scope for Current Release

- Real-time GPS tracking of delivery runners
- In-app chat between customers, vendors, and operators
- Rating and review system for vendors and runners
- Promotional discount codes or loyalty programs
- Multi-language support beyond English
- Integration with external payment gateways (e.g., Paystack, Flutterwave)
- Automated runner assignment algorithm
- Vendor onboarding approval process
- Social media sharing features
- Scheduled order placement for future delivery times
- Support ticket tracking and status updates for submitted requests
- Live chat support within CustomerCare screen
- Advanced analytics dashboards with predictive modeling
- Automated fraud detection and prevention systems
- Multi-currency support
- Vendor performance scoring and ranking algorithms
- Customer segmentation and targeted marketing campaigns
- Inventory management system for vendors
- Automated tax calculation and reporting
- Integration with campus ID card systems
- Geofencing for campus boundary enforcement
- Voice ordering capabilities
- AR menu visualization features