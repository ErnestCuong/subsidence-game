import Road from "../components/Road"
import Water from "../components/Water"
import Home from "../components/Home"
import Factory from "../components/Factory"
import Tree from "../components/Tree"
import Trash from "../components/Trash"
import Default from "../components/Default"
import GrowingTree from "../components/GrowingTree"

export const CellType = {
  DEFAULT: 0,
  ROAD: 1,
  WATER: 2,
  HOME: 3,
  FACTORY: 4,
  TREE: 5,
  TRASH: 6,
  GROWINGTREE: 7,
}

const Cell = ({ onClick, cellType, disabled, className }) => {
  return (
    <div className={`w-full h-full ${className ?? ''}`}>
      {cellType === CellType.DEFAULT && <Default onClick={onClick} disabled={disabled} />}
      {cellType === CellType.ROAD && <Road onClick={onClick} disabled={disabled} />}
      {cellType === CellType.WATER && <Water onClick={onClick} disabled={disabled} />}
      {cellType === CellType.HOME && <Home onClick={onClick} disabled={disabled} />}
      {cellType === CellType.FACTORY && <Factory onClick={onClick} disabled={disabled} />}
      {cellType === CellType.TREE && <Tree onClick={onClick} disabled={disabled} />}
      {cellType === CellType.TRASH && <Trash onClick={onClick} disabled={disabled} />}
      {cellType === CellType.GROWINGTREE && <GrowingTree onClick={onClick} disabled={disabled} />}
    </div>
  )
}

export default Cell