import { useComponentsContext, useDictionary, DragHandleMenu } from '@blocknote/react'
import { MdDragIndicator } from 'react-icons/md'
import type { SideMenuProps } from '@blocknote/react'

/**
 * 自定义 SideMenu，只显示拖拽抓手，不显示 + 新增按钮
 * 这解决了左侧冗余图标占用空间、导致文本偏移的问题
 */
export function DragOnlySideMenu<
  BSchema extends { [key: string]: any } = { [key: string]: any },
  I extends { [key: string]: any } = { [key: string]: any },
  S extends { [key: string]: any } = { [key: string]: any }
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
            icon={<MdDragIndicator size={20} data-test="dragHandle" />}
          />
        </Components.Generic.Menu.Trigger>
        <DragHandleMenu block={props.block}>
          {props.children}
        </DragHandleMenu>
      </Components.Generic.Menu.Root>
    </Components.SideMenu.Root>
  )
}
