import { useEffect } from "react";
import { CellType } from "./Cell";
import Home from "../components/Home";
import Road from "../components/Road";

const ActionDialog = ({ id, isOpen, setNotOpen, cellType, setCellType }) => {
  useEffect(() => {
    if (isOpen) {
      document.getElementById(id).showModal()
      return
    }
  }, [isOpen, id])

  const closeModal = () => {
    document.getElementById(id).close();
    setNotOpen();
  }

  return (
    <dialog id={id} className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-2xl">Choose an action</h3>
        <div className="grid grid-cols-2 gap-4 my-10">

          <div className="flex flex-row gap-2 items-center">
            <label className="font-bold">Build a Road</label>
            <div className="w-10 h-10">
              <Road
                onClick={() => {
                  setCellType(CellType.ROAD);
                  closeModal()
                }}
              />
            </div>
          </div>

          <div className="flex flex-row gap-2 items-center">
            <label className="font-bold">Build a Home</label>
            <div className="w-10 h-10">
              <Home
                onClick={() => {
                  setCellType(CellType.HOME);
                  closeModal()
                }}
              />
            </div>
          </div>

        </div>
        <div className="modal-action">
            <button className="btn" onClick={closeModal}>Close</button>
        </div>
      </div>
    </dialog>
  )
}

export default ActionDialog