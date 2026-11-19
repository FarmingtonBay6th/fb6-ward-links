/* Anonymous family history counts. Both addresses are public on purpose.
   Each saved row is a month, a group, and a number. No names, phones, or emails.
   scriptUrl is the Bay 6 Hub web app, which keeps the counts in a private Google
   Sheet that does not expire. The page uses it as soon as it reports live, and
   uses the older crudcrud address (base) only until then. */
window.FH_COUNTS_CONFIG = {
  scriptUrl: "https://script.google.com/macros/s/AKfycbxr5GFPfuj7TLPKwM--a15B7Rt7sOzPAWhEkPPCU9HW0IlAroqTX0MqcvXwGc0LWUFK/exec",
  base: "https://crudcrud.com/api/82ef7eba0b3a4ca7ad48b0013e7a16b1/counts"
};
