
import pg from 'pg';
const { Client } = pg;

async function setupDatabase() {
    const adminClient = new Client({
        connectionString: 'postgres://postgres:Galax@localhost:5432/postgres',
    });

    try {
        await adminClient.connect();
        console.log('Conectado a la base de datos por defecto postgres.');

        const res = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = 'bus_incident_manager'");
        if (res.rowCount === 0) {
            console.log("La base de datos 'bus_incident_manager' no existe. Creándola...");
            await adminClient.query('CREATE DATABASE bus_incident_manager');
            console.log("Base de datos 'bus_incident_manager' creada exitosamente.");
        } else {
            console.log("La base de datos 'bus_incident_manager' ya existe.");
        }
    } catch (err) {
        console.error('Error al configurar la base de datos:', err);
        process.exit(1);
    } finally {
        await adminClient.end();
    }
}

setupDatabase();
