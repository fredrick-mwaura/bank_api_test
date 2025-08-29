import Role from "../../app/Models/Roles";

const roles = [
  {
    name: "user",
    Permissions: [
      "view_own_profile",
      "edit_own_profile",
      "delete_own_profile",
      "create_transaction",
      "view_own_transactions",
      "initiate_transfer",
      "view_own_balance",
      "view_own_statements"
    ]
  },
  {
    name: "admin",
    Permissions: [
      "view_any_profile",
      "edit_any_profile",
      "delete_any_profile",
      "create_transaction",
      "view_any_transactions",
      "initiate_transfer",
      "view_any_balance",
      "view_any_statements",
      "manage_users"
    ]
  },
  {
    name: "superadmin",
    Permissions: [
      "view_any_profile",
      "edit_any_profile",
      "delete_any_profile",
      "create_transaction",
      "view_any_transactions",
      "initiate_transfer",
      "view_any_balance",
      "view_any_statements",
      "manage_users",
      "manage_system_settings"
    ]
  }
]