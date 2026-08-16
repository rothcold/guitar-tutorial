import { defineHastPlugin } from "satteri";

export const accessibleTablesPlugin = defineHastPlugin({
  name: "accessible-tables",
  element: {
    filter: ["table"],
    visit(node, context) {
      context.setProperty(node, "tabIndex", 0);
    },
  },
});
