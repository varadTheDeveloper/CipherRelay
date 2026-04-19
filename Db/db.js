/*
 * Copyright (c) 2026 Varad Dnyaneshwar Modhekar
 * Licensed under the GNU Affero General Public License v3.0
 */
import pkg from "pg";
// below are only testing purpose not real
// host:"localhost",
// port : 5432,
// user:"postgres", 
// password:"varad",
// database:"maris"
const { Pool } = pkg;
const pool = new  Pool({
host:"localhost",
port : 5432,
user:"postgres", 
password:"varad",
database:"maris"
})
console.log(pool)
export default pool