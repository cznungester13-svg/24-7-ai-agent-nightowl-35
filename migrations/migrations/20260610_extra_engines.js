/**
 *Up migration: Establish the database architecture for the advanced engines
 */
async function up(pool) {
  //1.Financial profiles to calculate the 5% profit threshold
  await pool.query('
    CREATE TABLE IF NOT EXISTS business_financials(
      id SEREALPRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      avg_weekly_profit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ');

  //2. SaaS tool items for Subscription Stack Auditing
  await pool.query('
    CREATE TABLE IF NOT EXISTS subscription_items('
      id SEREAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      tool_name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      monthly_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      detected_features TEXT[], 
      is_duplicate BOOLEAN DEFAULT FALSE, 
      potential_savings NUMERIC(10,2) DEFAULT 0.00,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ');
}

/**
 *Down migration: Clean up if rolling back changes
 */
async function down(pool){
  await pool.query('DROP TABLE IF EXISTS subscription_items;');
  await pool.query('DROP TABLE IF EXISTS business_financials;');
}
// Advanced Engine Data Helpers
async function getFinancialsByUserId(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM subscription_items WHERE user_id = $1', [userId]);
    for (const item of items) {
      await client.query('
        INSERT INTO subscription_items (user_id, tool_name, category, monthly_cost, detected_features, is_duplicate, Potential_savings)                                                                                                                                                                                                                                                                                                                                                       
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      ', [userId, item.tool_name, item.category, item.monthly_cost, item.detected_features, item.is_duplicate,item.potential_savings]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROOLBACK');
    throw err;
  } finally {
    client.release();
  }
}
module.exports =  {
  pool,
  insertLead,
  logPageView,
  logAnalyticsEvent,
  // Add these two lines right here:
  getFinancialsByUserId,
  saveAuditItems
};
