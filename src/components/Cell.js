import Road from "./Road"
import Water from "./Water"
import Home from "./Home"
import Factory from "./Factory"
import Tree from "./Tree"
import Trash from "./Trash"
import Default from "./Default"
import { useState } from "react"

export const CellType = {
  DEFAULT: 0,
  ROAD: 1,
  WATER: 2,
  HOME: 3,
  FACTORY: 4,
  TREE: 5,
  TRASH: 6
}

const Cell = ({ id }) => {
  const [cellType, setCellType] = useState(CellType.DEFAULT)
  const openModal = () => document.getElementById(id).showModal()

  return (
    <>
      {cellType === CellType.DEFAULT && <Default onClick={openModal} />}
      {cellType === CellType.ROAD && <Road />}
      {cellType === CellType.WATER && <Water />}
      {cellType === CellType.HOME && <Home />}
      {cellType === CellType.FACTORY && <Factory />}
      {cellType === CellType.TREE && <Tree />}
      {cellType === CellType.TRASH && <Trash />}

      <dialog id={id} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Hello!</h3>
          <p className="py-4">Press ESC key or click the button below to close</p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  )
}

export default Cell