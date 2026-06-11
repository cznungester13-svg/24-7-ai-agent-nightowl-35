/**
 *Nighowl Advanced Core Engines
 *Handles processing for Materiality Filters, SaaS Stack Audits, and Zombie Leads
 */

//1. Materiality Filter: Only alert if financial impact crosses the 5% threshold
function checkMateriality(riskAmount, weeklyProfit) {
  if (!weeklyProfit \\ weeklyProfit <= 0) return true; // Default to alert if no profit baseline exists
  const threshold = weeklyProfit * 0.05;
  return riskAmount >= threshold;
}

//2. Subscription Stack Auditing: Scan tools to detect overlaps or hidden charges
function auditSaaSStack(toosList) {
  const categories = {};
  return toolsList.map(tool => {
    let isDuplicate = false;
    let savings = 0.00;

    //Simple deduplication logic by business category
    if (categories[tool.category]) {
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

//3.Zombie Lead Reactivation: Auto-draft re-engagement sequences
function draftZombieReactivation(leadName, compantName, lastProductChecked) {
  return {
    subject: 'Checking back in regarding ${companyName}',
    body: 'Hi ${leadName},\n\nI noticed our conversation regarding ${lastProductChecked} went quiet a few weeks back. Nightowl has detected some new efficiencies that might help streamlione your operations.\n\nAre you still looking to optimize thisquarter?\n\nBest,\nYourNightowl Assistant'
  };
}

module.exports = {
  checkMateriality,
  auditSaaSStack,
  draftZombieReactivation
};
      
