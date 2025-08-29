import Permission from "../../app/Models/Permissions.js";
import Role from "../../app/Models/Roles.js";
import db from '../../config/database.js'

export const seedRolesAndPermission = async () => {
  // permissions
  await db.connectDB()
  await Permission.deleteMany({});  //delete * existing permissions

  const [manageOwn, viewLogs, systemAccess] = await Permission.insertMany([
    { name: "manage_own_account", description: "User can manage their own account only" },
    { name: "view_logs", description: "Admin can view logs" },
    { name: "system_access", description: "SuperAdmin can access all system data (except user accounts)" },
  ]);

  // roles
  await Role.deleteMany({}) //delete * existing roles

  await Role.insertMany([
    { name: "user", permissions: manageOwn._id },
    { name: "admin", permissions: viewLogs._id },
    { name: "superadmin", permissions: systemAccess._id },
  ]);
  console.log("Roles and permissions seeded successfully");
  process.exit(0)
};
seedRolesAndPermission()
