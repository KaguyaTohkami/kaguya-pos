"use client";

import type {
  CartItem,
  Staff,
} from "@/types/pos";


type Props = {
  open: boolean;

  cart: CartItem[];

  staff: Staff | null;

  subtotal: number;

  tax: number;

  total: number;


  onClose: () => void;


  onComplete: () => void;
};



export default function Checkout({
  open,
  cart,
  staff,
  subtotal,
  tax,
  total,
  onClose,
  onComplete,
}: Props) {


  if (!open) {
    return null;
  }



  return (
    <div
      className="overlay"
      onClick={onClose}
    >

      <div
        className="modal checkoutModal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >


        <button
          className="close"
          onClick={onClose}
        >
          ×
        </button>




        <div
          className="modalBody"
        >


          <h2>
            会計確認
          </h2>




          <div
            className="checkoutStaff"
          >

            <span>
              担当スタッフ
            </span>


            <strong>
              {
                staff
                  ? staff.name
                  : "未選択"
              }
            </strong>


          </div>





          <div
            className="checkoutItems"
          >

            {cart.map(
              (item) => (

                <div
                  className="checkoutItem"
                  key={
                    item.id
                  }
                >

                  <span>
                    {item.name}
                    {" × "}
                    {item.quantity}
                  </span>


                  <strong>
                    ¥
                    {(
                      item.price *
                      item.quantity
                    ).toLocaleString(
                      "ja-JP"
                    )}
                  </strong>


                </div>

              )
            )}

          </div>






          <div
            className="checkoutSummary"
          >

            <div>

              <span>
                小計
              </span>

              <strong>
                ¥
                {subtotal.toLocaleString(
                  "ja-JP"
                )}
              </strong>

            </div>




            <div>

              <span>
                税
              </span>

              <strong>
                ¥
                {tax.toLocaleString(
                  "ja-JP"
                )}
              </strong>

            </div>





            <div
              className="checkoutTotal"
            >

              <span>
                合計
              </span>


              <strong>
                ¥
                {total.toLocaleString(
                  "ja-JP"
                )}
              </strong>

            </div>


          </div>







          <button
            className="primary full"
            disabled={
              !staff ||
              cart.length === 0
            }
            onClick={
              onComplete
            }
          >

            会計を確定する

          </button>



        </div>



      </div>


    </div>
  );
}
