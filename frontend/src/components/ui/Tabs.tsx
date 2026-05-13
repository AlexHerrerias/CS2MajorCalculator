import React from "react";
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@headlessui/react";

export interface TabsProps {
  tabs: { label: string; content: React.ReactNode }[];
  defaultIndex?: number;
  onChange?: (index: number) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultIndex = 0,
  onChange,
}) => (
  <TabGroup defaultIndex={defaultIndex} onChange={onChange}>
    <TabList className="flex border-b border-gray-700 mb-4 overflow-x-auto">
      {tabs.map((tab) => (
        <Tab
          key={tab.label}
          className={({ selected }) =>
            [
              "px-4 py-2 text-fluid-sm font-medium border-b-2 transition-colors focus:outline-none whitespace-nowrap",
              selected
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200",
            ].join(" ")
          }
        >
          {tab.label}
        </Tab>
      ))}
    </TabList>
    <TabPanels>
      {tabs.map((tab) => (
        <TabPanel key={tab.label}>{tab.content}</TabPanel>
      ))}
    </TabPanels>
  </TabGroup>
);
