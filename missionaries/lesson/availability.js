/* Open and taken evenings for the Sister Missionary lesson schedule.
   Read on November 7, 2026 from the stake calendar "Farmington Bay Stake
   Member/Missionary Lessons". Every Monday–Friday cell in this range is a
   lesson slot. Saturday and Sunday cells are not slots. A date is taken only
   when that cell's Name line was not empty.
   Names, wards, and addresses from existing signups are not stored here. */
(function (root, factory) {
  var data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  if (root) root.LESSON_AVAILABILITY = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    checkedOn: "2026-11-07",
    rangeStart: "2026-11-09",
    rangeEnd: "2026-12-31",
    taken: ["2026-11-09", "2026-11-10"]
  };
});
