import { clientEntry, css, type EntryComponent, type Handle, on, type SerializableProps } from "remix/ui"
import { routes } from "../routes.js"
import { tk } from "../ui/tokens.js"

interface EnvSelectorProps extends SerializableProps {
  environments: Array<{ id: string; name: string; isDefault: boolean }>
  activeEnvId: string | null
  // Path to return to after switching (so the user stays on the same page).
  currentPath: string
}

const s = {
  form: css({
    display: "flex",
    alignItems: "center",
    gap: ".35rem",
    padding: ".25rem 1rem .5rem"
  }),
  select: css({
    flex: 1,
    minWidth: 0,
    padding: ".3rem .35rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: tk.fg,
    fontFamily: tk.fontSans,
    fontSize: ".72rem",
    cursor: "pointer"
  })
}

// Environment switcher. Hydrated as a client island so changing the select
// navigates straight to `/select-env` (which stores the choice and 303-redirects
// back) — no manual submit button. Server-rendered first, so the chosen option
// is already correct before hydration.
export const EnvSelector: EntryComponent<EnvSelectorProps> = clientEntry(
  import.meta.url,
  function EnvSelector(handle: Handle<EnvSelectorProps>) {
    const switchEnv = (target: HTMLSelectElement) => {
      if (!target.value) return
      const url = `${routes.selectEnv.href()}?envId=${encodeURIComponent(target.value)}`
        + `&returnTo=${encodeURIComponent(handle.props.currentPath)}`
      window.location.assign(url)
    }

    return () => {
      const { activeEnvId, environments } = handle.props
      return (
        <form mix={s.form} method="get" action={routes.selectEnv.href()}>
          <input type="hidden" name="returnTo" value={handle.props.currentPath} />
          <select
            mix={[s.select, on<HTMLSelectElement>("change", (event) => switchEnv(event.currentTarget))]}
            name="envId"
          >
            {!activeEnvId && <option value="">— Select —</option>}
            {environments.map((env) => (
              <option value={env.id} selected={env.id === activeEnvId}>
                {env.name}
                {env.isDefault ? " ★" : ""}
              </option>
            ))}
          </select>
        </form>
      )
    }
  }
)
