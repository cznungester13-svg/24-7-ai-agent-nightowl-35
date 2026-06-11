/**
 *Nightowl Advanced Core Engines
 *Handles processing for Materiality Filters, SaaS Stack Audits, and Zombie Leads
 */

//1. Materiality Filter: Only alert if financial impact crosses the 5% threshold
function checkMateriality(riskAmount,weeklyProfit) {
  if (!weeklyProfit || weeklyProfit <= 0) return true; // Default to alert if no profit baseline exists
  const threshold = weeklyProfit * 0.05;
  return riskAmount >= threshold;
}

//2.Subscription Stack Auditing: Scan tools to detect overlaps or hiddencharges
function auditSaaSStack(toolsList) {
  const categories = {};
  return toosList.map(tool =>{
    let isDuplicate = false;
    let savings = 0.00;
    
    // Simple deduplication logic by business category
    if (categories[tool.caregory]) {
      isDuplicate = true;
      savings = tool.monthly_cost;
    } else {
      categories[tool.category] = tool.tool_name;
    }
    return {
      ...tool,
      is_duplicate: isDuplicate,
      potential_savings: savings
    };
  });
}

//3. Zombie Lead Reactivation: Auto-draft re-engagement sequences
function draftZombieReactivation(leadName, companyName, lastProductChecked) {
  return {
    subject: 'Checking back in regarding ${companyName}',
    body: 'Hi ${leadName},\n\nI notice our conversation regarding ${lastProductChecked} went quite a few weeks back.Nightowl has detected some new efficiencies that might help streamline your operations.\n\nAre you still looking to optimize this quarter?\n\nBest,\nYour Nightowl Assistant'
  };
}
module.exports = {
  checkMateriability,
  auditSaaSStack,
  draftZombieReactivation
};
    
    
