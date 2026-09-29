module.exports = {
  ACTION_CHECK_FUEL: 'unitswitch_check_fuel',
  ACTION_CHECK_SAMSARA: 'unitswitch_check_samsara',
  ACTION_CHECK_TMS: 'unitswitch_check_tms',
};

const CHECK_ACTIONS = new Set([
  module.exports.ACTION_CHECK_FUEL,
  module.exports.ACTION_CHECK_SAMSARA,
  module.exports.ACTION_CHECK_TMS,
]);

module.exports.CHECK_ACTIONS = CHECK_ACTIONS;

module.exports.ACTION_TO_SYSTEM = {
  [module.exports.ACTION_CHECK_FUEL]: 'fuel',
  [module.exports.ACTION_CHECK_SAMSARA]: 'samsara',
  [module.exports.ACTION_CHECK_TMS]: 'tms',
};

module.exports.ACTION_REVERT_FUEL = 'unitswitch_revert_fuel';
module.exports.ACTION_REVERT_SAMSARA = 'unitswitch_revert_samsara';
module.exports.ACTION_REVERT_TMS = 'unitswitch_revert_tms';

const REVERT_ACTIONS = new Set([
  module.exports.ACTION_REVERT_FUEL,
  module.exports.ACTION_REVERT_SAMSARA,
  module.exports.ACTION_REVERT_TMS,
]);

module.exports.REVERT_ACTIONS = REVERT_ACTIONS;

module.exports.ACTION_TO_SYSTEM_REVERT = {
  [module.exports.ACTION_REVERT_FUEL]: 'fuel',
  [module.exports.ACTION_REVERT_SAMSARA]: 'samsara',
  [module.exports.ACTION_REVERT_TMS]: 'tms',
};
