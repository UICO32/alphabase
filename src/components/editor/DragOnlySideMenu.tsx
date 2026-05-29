import { useComponentsContext, useDictionary, DragHandleMenu } from '@blocknote/react'
import { GripVertical } from 'lucide-react'
import type { SideMenuProps } from '@blocknote/react'
import type { BlockSchema, InlineContentSchema, StyleSchema } from '@blocknote/core'

export function DragOnlySideMenu<
  BSchema extends BlockSchema = BlockSchema,
  I extends InlineContentSchema = InlineContentSchema,
  S extends StyleSchema = StyleSchema
>(
  props: SideMenuProps<BSchema, I, S> & { children?: React.ReactNode }
) {
  const Components = useComponentsContext()
  const dict = useDictionary()

  // 必须在 SideMenuController 内部使用
  if (!Components || !dict) {
    return null
  }

  return (
    <Components.SideMenu.Root className="bn-side-menu bn-side-menu-drag-only">
      <Components.Generic.Menu.Root
        onOpenChange={(open: boolean) => {
          if (open) {
            props.freezeMenu()
          } else {
            props.unfreezeMenu()
          }
        }}
        position="left"
      >
        <Components.Generic.Menu.Trigger>
          <Components.SideMenu.Button
            label={dict.side_menu.drag_handle_label}
            draggable={true}
            onDragStart={(e) => props.blockDragStart(e as unknown as React.DragEvent, props.block)}
            onDragEnd={props.blockDragEnd}
            className="bn-button bn-drag-handle-button"
            icon={<GripVertical size={20} data-test="dragHandle" />}
          />
        </Components.Generic.Menu.Trigger>
        <DragHandleMenu block={props.block}>
          {props.children}
        </DragHandleMenu>
      </Components.Generic.Menu.Root>
    </Components.SideMenu.Root>
  )
}
