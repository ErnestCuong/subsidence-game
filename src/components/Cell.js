import Road from "./Road"
import Water from "./Water"
import Home from "./Home"
import Factory from "./Factory"
import Tree from "./Tree"
import Trash from "./Trash"
import Default from "./Default"

export const CellType = {
  DEFAULT: 0,
  ROAD: 1,
  WATER: 2,
  HOME: 3,
  FACTORY: 4,
  TREE: 5,
  TRASH: 6
}

const Cell = ({ onClick, cellType }) => {
  return (
    <>
      {cellType === CellType.DEFAULT && <Default onClick={onClick} />}
      {cellType === CellType.ROAD && <Road onClick={onClick} />}
      {cellType === CellType.WATER && <Water onClick={onClick} />}
      {cellType === CellType.HOME && <Home onClick={onClick} />}
      {cellType === CellType.FACTORY && <Factory onClick={onClick} />}
      {cellType === CellType.TREE && <Tree onClick={onClick} />}
      {cellType === CellType.TRASH && <Trash onClick={onClick} />}
    </>
  )
}

export default Cell