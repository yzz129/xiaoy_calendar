import DoodleIcon from './DoodleIcon'

export default function Logo() {
  return (
    <div className="brand" aria-label="小Y日历">
      <DoodleIcon name="mascot" className="brand-mark" />
      <span>小Y日历</span>
    </div>
  )
}
