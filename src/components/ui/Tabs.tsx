import {
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/shadcn/tabs'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  value: string
  onValueChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, value, onValueChange, className = '' }: TabsProps) {
  return (
    <TabsRoot value={value} onValueChange={onValueChange} className={className}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.icon}
            <span>{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} />
      ))}
    </TabsRoot>
  )
}
