import { useEffect } from "react";
import { CellType } from "./Cell";
import Home from "./Home";
import Road from "./Road";

const ActionDialog = ({ id, isOpen, setNotOpen, cellType, setCellType }) => {
  useEffect(() => {
    if (isOpen) {
      document.getElementById(id).showModal()
      return
    }
  }, [isOpen])

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
          <form method="dialog">
            {/* if there is a button in form, it will close the modal */}
            <button className="btn">Close</button>
          </form>
        </div>
      </div>
    </dialog>
  )
}

export default ActionDialog