import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function diagnose() {
    console.log("🔍 Diagnostic check for Galaxias user\n");

    try {
        // Check all users
        const allUsers = await db.select().from(users);
        console.log(`Total users in database: ${allUsers.length}\n`);

        if (allUsers.length === 0) {
            console.log("❌ No users found in database!");
            console.log("The database might not be properly initialized.\n");
        } else {
            console.log("All users:");
            allUsers.forEach(user => {
                console.log(`  - ID: ${user.id}`);
                console.log(`    Username: ${user.username}`);
                console.log(`    Name: ${user.name}`);
                console.log(`    Role: ${user.role}`);
                console.log(`    Active: ${user.active} (type: ${typeof user.active})`);
                console.log(`    Password hash exists: ${!!user.password}`);
                console.log("");
            });
        }

        // Check specifically for Galaxias
        const [galaxiasUser] = await db.select().from(users).where(eq(users.username, "Galaxias"));

        if (!galaxiasUser) {
            console.log("❌ Galaxias user NOT found!");
            console.log("This means the initialization in storage.ts did not run or failed.\n");
        } else {
            console.log("✅ Galaxias user found!");
            console.log(`  ID: ${galaxiasUser.id}`);
            console.log(`  Username: ${galaxiasUser.username}`);
            console.log(`  Name: ${galaxiasUser.name}`);
            console.log(`  Role: ${galaxiasUser.role}`);
            console.log(`  Active: "${galaxiasUser.active}" (type: ${typeof galaxiasUser.active})`);
            console.log(`  Active === "true": ${galaxiasUser.active === "true"}`);
            console.log(`  Active !== "true": ${galaxiasUser.active !== "true"}`);
        }

    } catch (error) {
        console.error("❌ Error during diagnostic:", error);
    }

    process.exit(0);
}

diagnose();
